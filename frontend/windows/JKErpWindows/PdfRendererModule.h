#pragma once

#include "pch.h"
#include <NativeModules.h>
#include <algorithm>
#include <string>
#include <vector>
#include <atomic>
#include <winrt/Windows.ApplicationModel.Core.h>
#include <winrt/Windows.Data.Pdf.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Printing.h>
#include <winrt/Windows.Storage.Pickers.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.UI.Core.h>
#include <winrt/Windows.UI.Xaml.Controls.h>
#include <winrt/Windows.UI.Xaml.Media.Imaging.h>
#include <winrt/Windows.UI.Xaml.Media.h>
#include <winrt/Windows.UI.Xaml.Printing.h>
#include <winrt/Windows.UI.Xaml.h>
#include <winrt/Windows.Web.Http.Headers.h>
#include <winrt/Windows.Web.Http.h>

using namespace winrt::Microsoft::ReactNative;
using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::Storage;
using namespace winrt::Windows::Storage::Streams;
using namespace winrt::Windows::Data::Pdf;
using namespace winrt::Windows::Web::Http;

namespace winrt {
namespace JKErpWindows {
REACT_MODULE_NOREG(PdfRenderer, L"PdfRenderer")
struct PdfRenderer {
  inline static std::atomic<uint64_t> s_fileCounter{0};
  REACT_METHOD(RenderPdf)
  void RenderPdf(std::string url, std::string invoiceId,
                 ReactPromise<std::vector<std::string>> promise) noexcept {
    RenderPdfAsync(std::move(url), std::move(invoiceId), "",
                   std::move(promise));
  }

  REACT_METHOD(RenderPdfWithToken)
  void
  RenderPdfWithToken(std::string url, std::string invoiceId,
                     std::string authToken,
                     ReactPromise<std::vector<std::string>> promise) noexcept {
    RenderPdfAsync(std::move(url), std::move(invoiceId), std::move(authToken),
                   std::move(promise));
  }

private:
  IAsyncAction RenderPdfAsync(std::string url, std::string invoiceId,
                              std::string authToken,
                              ReactPromise<std::vector<std::string>> promise) {
    try {
      // 1. Temp folder cleanup of old render files
      StorageFolder tempFolder = ApplicationData::Current().TemporaryFolder();
      auto files = co_await tempFolder.GetFilesAsync();
      std::vector<StorageFile> filesToDelete;
      for (auto const &file : files) {
        std::wstring name{file.Name()};
        if (name.find(L"_page_") != std::wstring::npos ||
            name.find(L"DirectPrint_") != std::wstring::npos ||
            name.find(L"PrintPage_") != std::wstring::npos) {
          filesToDelete.push_back(file);
        }
      }
      for (auto const &file : filesToDelete) {
        try {
          co_await file.DeleteAsync();
        } catch (...) {
          // Ignore files that are locked/in-use
        }
      }

      // 2. Download PDF bytes
      HttpClient client;
      if (!authToken.empty()) {
        client.DefaultRequestHeaders().TryAppendWithoutValidation(
            L"Authorization", winrt::to_hstring("Bearer " + authToken));
      }
      Uri uri{winrt::to_hstring(url)};
      HttpResponseMessage response = co_await client.GetAsync(uri);
      if (!response.IsSuccessStatusCode()) {
        promise.Reject(
            ("HTTP error: " + std::to_string((int)response.StatusCode()))
                .c_str());
        co_return;
      }

      IBuffer buffer = co_await response.Content().ReadAsBufferAsync();

      m_cachedPdfBuffer = buffer;
      m_cachedPdfUrl = url;
      m_pageFilePaths.clear();

      // 3. Load PDF from buffer
      InMemoryRandomAccessStream stream;
      co_await stream.WriteAsync(buffer);
      stream.Seek(0);

      PdfDocument pdfDoc = co_await PdfDocument::LoadFromStreamAsync(stream);
      uint32_t pageCount = pdfDoc.PageCount();

      std::vector<std::string> pagePaths;

      // 4. Render each page
      for (uint32_t i = 0; i < pageCount; ++i) {
        PdfPage page = pdfDoc.GetPage(i);

        uint64_t fileId = ++s_fileCounter;
        winrt::hstring filename =
            winrt::to_hstring(invoiceId) + L"_" +
            winrt::to_hstring(std::to_wstring(GetTickCount64()).c_str()) + L"_" +
            winrt::to_hstring(std::to_wstring(fileId).c_str()) + L"_page_" +
            winrt::to_hstring(std::to_wstring(i).c_str()) + L".png";
            
        StorageFile imgFile = nullptr;
        try {
          imgFile = co_await tempFolder.CreateFileAsync(
              filename, CreationCollisionOption::ReplaceExisting);
        } catch (winrt::hresult_error const& ex) {
          promise.Reject(("CreateFile Error: " + winrt::to_string(filename) + " - " + winrt::to_string(ex.message())).c_str());
          co_return;
        }

        IRandomAccessStream imgStream = nullptr;
        try {
          imgStream = co_await imgFile.OpenAsync(FileAccessMode::ReadWrite);
        } catch (winrt::hresult_error const& ex) {
          promise.Reject(("OpenStream Error: " + winrt::to_string(filename) + " - " + winrt::to_string(ex.message())).c_str());
          co_return;
        }

        PdfPageRenderOptions options;
        options.DestinationWidth(static_cast<uint32_t>(page.Size().Width * 4));
        
        try {
          co_await page.RenderToStreamAsync(imgStream, options);
          co_await imgStream.FlushAsync();
        } catch (winrt::hresult_error const& ex) {
          promise.Reject(("RenderToStream Error: " + winrt::to_string(filename) + " - " + winrt::to_string(ex.message())).c_str());
          imgStream.Close();
          co_return;
        }
        
        imgStream.Close();
        page.Close();

         // Formulate file URI scheme
        std::string pathStr = "file:///" + winrt::to_string(imgFile.Path());
        std::replace(pathStr.begin(), pathStr.end(), '\\', '/');
        pagePaths.push_back(pathStr);
      }
      
      promise.Resolve(pagePaths);
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("WinRT Error: " + winrt::to_string(ex.message())).c_str());
    } catch (std::exception const &ex) {
      promise.Reject(("Std Error: " + std::string(ex.what())).c_str());
    } catch (...) {
      promise.Reject("Unknown Native Error during rendering");
    }
  }

public:
  REACT_METHOD(PrintPdfUrl)
  void PrintPdfUrl(std::string url, ReactPromise<bool> promise) noexcept {
    PrintPdfUrlAsync(std::move(url), "", std::move(promise));
  }

  REACT_METHOD(PrintPdfUrlWithToken)
  void PrintPdfUrlWithToken(std::string url, std::string authToken,
                            ReactPromise<bool> promise) noexcept {
    PrintPdfUrlAsync(std::move(url), std::move(authToken), std::move(promise));
  }

  REACT_METHOD(SavePdfFile)
  void SavePdfFile(std::string url, std::string suggestedName,
                   ReactPromise<bool> promise) noexcept {
    if (m_cachedPdfUrl == url && m_cachedPdfBuffer != nullptr) {
      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [this, suggestedName, promise]() {
            auto action =
                SavePdfFileUIThread(m_cachedPdfBuffer, suggestedName, promise);
          });
    } else {
      SavePdfFileAsync(std::move(url), std::move(suggestedName), "",
                       std::move(promise));
    }
  }

  REACT_METHOD(SavePdfFileWithToken)
  void SavePdfFileWithToken(std::string url, std::string suggestedName,
                            std::string authToken,
                            ReactPromise<bool> promise) noexcept {
    if (m_cachedPdfUrl == url && m_cachedPdfBuffer != nullptr) {
      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [this, suggestedName, promise]() {
            auto action =
                SavePdfFileUIThread(m_cachedPdfBuffer, suggestedName, promise);
          });
    } else {
      SavePdfFileAsync(std::move(url), std::move(suggestedName),
                       std::move(authToken), std::move(promise));
    }
  }

  REACT_METHOD(SaveFile)
  void SaveFile(std::string url, std::string suggestedName,
                std::string fileTypeLabel, std::string extension,
                ReactPromise<bool> promise) noexcept {
    SaveFileAsync(std::move(url), std::move(suggestedName),
                  std::move(fileTypeLabel), std::move(extension), "",
                  std::move(promise));
  }

  REACT_METHOD(SaveFileWithToken)
  void SaveFileWithToken(std::string url, std::string suggestedName,
                         std::string fileTypeLabel, std::string extension,
                         std::string authToken,
                         ReactPromise<bool> promise) noexcept {
    SaveFileAsync(std::move(url), std::move(suggestedName),
                  std::move(fileTypeLabel), std::move(extension),
                  std::move(authToken), std::move(promise));
  }

private:
  winrt::Windows::UI::Xaml::Printing::PrintDocument m_printDocument{nullptr};
  winrt::event_token m_printTaskRequestedToken;
  std::vector<std::wstring> m_pageFilePaths;
  winrt::Windows::Graphics::Printing::IPrintDocumentSource
      m_printDocumentSource{nullptr};
  winrt::Windows::Storage::Streams::IBuffer m_cachedPdfBuffer{nullptr};
  std::string m_cachedPdfUrl;

  void InitializePrintDocument() {
    if (m_printDocument != nullptr) {
      try {
        auto printManager =
            winrt::Windows::Graphics::Printing::PrintManager::GetForCurrentView();
        printManager.PrintTaskRequested(m_printTaskRequestedToken);
      } catch (...) {}
      m_printDocument = nullptr;
      m_printDocumentSource = nullptr;
    }

    m_printDocument = winrt::Windows::UI::Xaml::Printing::PrintDocument();
    m_printDocumentSource = m_printDocument.DocumentSource();

    m_printDocument.Paginate([this](auto const &sender, auto const &) {
      auto printDoc =
          sender
              .template as<winrt::Windows::UI::Xaml::Printing::PrintDocument>();
      printDoc.SetPreviewPageCount(
          static_cast<int32_t>(m_pageFilePaths.size()),
          winrt::Windows::UI::Xaml::Printing::PreviewPageCountType::Final);
    });

    m_printDocument.GetPreviewPage(
        [this](auto const &sender, auto const &args) {
          int32_t pageNumber = args.PageNumber();
          if (pageNumber > 0 &&
              pageNumber <= static_cast<int32_t>(m_pageFilePaths.size())) {
            winrt::Windows::UI::Xaml::Controls::Image image;
            image.Stretch(winrt::Windows::UI::Xaml::Media::Stretch::Uniform);

            winrt::Windows::UI::Xaml::Media::Imaging::BitmapImage bitmap;
            bitmap.UriSource(
                winrt::Windows::Foundation::Uri(m_pageFilePaths[pageNumber - 1]));
            image.Source(bitmap);

            auto printDoc =
                sender.as<winrt::Windows::UI::Xaml::Printing::PrintDocument>();
            printDoc.SetPreviewPage(pageNumber, image);
          }
        });

    m_printDocument.AddPages([this](auto const &sender, auto const &) {
      auto printDoc =
          sender.as<winrt::Windows::UI::Xaml::Printing::PrintDocument>();
      for (size_t i = 0; i < m_pageFilePaths.size(); ++i) {
        winrt::Windows::UI::Xaml::Controls::Image image;
        image.Stretch(winrt::Windows::UI::Xaml::Media::Stretch::Uniform);

        winrt::Windows::UI::Xaml::Media::Imaging::BitmapImage bitmap;
        bitmap.UriSource(
            winrt::Windows::Foundation::Uri(m_pageFilePaths[i]));
        image.Source(bitmap);

        printDoc.AddPage(image);
      }
      printDoc.AddPagesComplete();
    });

    auto printManager =
        winrt::Windows::Graphics::Printing::PrintManager::GetForCurrentView();
    m_printTaskRequestedToken =
        printManager.PrintTaskRequested([this](auto const &, auto const &args) {
          auto printTask = args.Request().CreatePrintTask(
              L"Invoice Print", [this](auto const &sourceArgs) {
                sourceArgs.SetSource(m_printDocumentSource);
              });
        });
  }

  IAsyncAction PrintPdfDirectAsync(std::string url,
                                   ReactPromise<bool> promise) {
    try {
      // 1. Download PDF bytes
      HttpClient client;
      Uri uri{winrt::to_hstring(url)};
      HttpResponseMessage response = co_await client.GetAsync(uri);
      if (!response.IsSuccessStatusCode()) {
        promise.Reject(
            ("HTTP error: " + std::to_string((int)response.StatusCode()))
                .c_str());
        co_return;
      }

      IBuffer buffer = co_await response.Content().ReadAsBufferAsync();

      // 2. Write to a temporary file
      StorageFolder tempFolder = ApplicationData::Current().TemporaryFolder();
      winrt::hstring filename =
          L"DirectPrint_" +
          winrt::to_hstring(std::to_wstring(GetTickCount64()).c_str()) +
          L".pdf";
      StorageFile tempFile = co_await tempFolder.CreateFileAsync(
          filename, CreationCollisionOption::ReplaceExisting);
      co_await FileIO::WriteBufferAsync(tempFile, buffer);

      // 3. Launch the file in the default PDF viewer (Edge/Acrobat) on the UI thread
      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      co_await dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [tempFile, promise]() {
            try {
              winrt::Windows::System::Launcher::LaunchFileAsync(tempFile);
              promise.Resolve(true);
            } catch (winrt::hresult_error const &ex) {
              promise.Reject(winrt::to_string(ex.message()).c_str());
            } catch (...) {
              promise.Reject("Failed to launch system viewer");
            }
          });
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("WinRT Error: " + winrt::to_string(ex.message())).c_str());
    } catch (std::exception const &ex) {
      promise.Reject(("Std Error: " + std::string(ex.what())).c_str());
    } catch (...) {
      promise.Reject("Unknown error opening PDF for printing");
    }
    co_return;
  }

  IAsyncAction PrintPdfUrlAsync(std::string url, std::string authToken,
                                ReactPromise<bool> promise) {
    try {
      HttpClient client;
      if (!authToken.empty()) {
        client.DefaultRequestHeaders().TryAppendWithoutValidation(
            L"Authorization", winrt::to_hstring("Bearer " + authToken));
      }
      Uri uri{winrt::to_hstring(url)};
      HttpResponseMessage response = co_await client.GetAsync(uri);
      if (!response.IsSuccessStatusCode()) {
        promise.Reject(
            ("HTTP error: " + std::to_string((int)response.StatusCode()))
                .c_str());
        co_return;
      }

      IBuffer buffer = co_await response.Content().ReadAsBufferAsync();

      InMemoryRandomAccessStream stream;
      co_await stream.WriteAsync(buffer);
      stream.Seek(0);

      PdfDocument pdfDoc = co_await PdfDocument::LoadFromStreamAsync(stream);
      uint32_t pageCount = pdfDoc.PageCount();

      StorageFolder tempFolder = ApplicationData::Current().TemporaryFolder();
      std::vector<std::wstring> pageFilePaths;

      for (uint32_t i = 0; i < pageCount; ++i) {
        PdfPage page = pdfDoc.GetPage(i);

        winrt::hstring filename =
            L"PrintPage_" +
            winrt::to_hstring(std::to_wstring(GetTickCount64()).c_str()) +
            L"_" + winrt::to_hstring(std::to_wstring(i).c_str()) + L".png";

        StorageFile imgFile = co_await tempFolder.CreateFileAsync(
            filename, CreationCollisionOption::ReplaceExisting);

        IRandomAccessStream imgStream = co_await imgFile.OpenAsync(FileAccessMode::ReadWrite);

        PdfPageRenderOptions options;
        options.DestinationWidth(static_cast<uint32_t>(page.Size().Width * 4));
        co_await page.RenderToStreamAsync(imgStream, options);
        co_await imgStream.FlushAsync();
        imgStream.Close();
        page.Close();

        pageFilePaths.push_back(L"file:///" + std::wstring(imgFile.Path()));
      }

      m_pageFilePaths = std::move(pageFilePaths);

      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [this, promise]() {
            try {
              InitializePrintDocument();
              winrt::Windows::Graphics::Printing::PrintManager::
                  ShowPrintUIAsync();
              promise.Resolve(true);
            } catch (winrt::hresult_error const &ex) {
              promise.Reject(winrt::to_string(ex.message()).c_str());
            } catch (...) {
              promise.Reject("Failed to show print dialog");
            }
          });
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("WinRT Error: " + winrt::to_string(ex.message())).c_str());
    } catch (std::exception const &ex) {
      promise.Reject(("Std Error: " + std::string(ex.what())).c_str());
    } catch (...) {
      promise.Reject("Unknown error preparing document for print");
    }
  }

private:
  IAsyncAction SavePdfFileAsync(std::string url, std::string suggestedName,
                                std::string authToken,
                                ReactPromise<bool> promise) {
    try {
      HttpClient client;
      if (!authToken.empty()) {
        client.DefaultRequestHeaders().TryAppendWithoutValidation(
            L"Authorization", winrt::to_hstring("Bearer " + authToken));
      }
      Uri uri{winrt::to_hstring(url)};
      HttpResponseMessage response = co_await client.GetAsync(uri);
      if (!response.IsSuccessStatusCode()) {
        promise.Reject(
            ("HTTP error: " + std::to_string((int)response.StatusCode()))
                .c_str());
        co_return;
      }
      IBuffer buffer = co_await response.Content().ReadAsBufferAsync();

      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [this, buffer, suggestedName, promise]() {
            SavePdfFileUIThread(buffer, suggestedName, promise);
          });
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("WinRT Error: " + winrt::to_string(ex.message())).c_str());
    } catch (std::exception const &ex) {
      promise.Reject(("Std Error: " + std::string(ex.what())).c_str());
    } catch (...) {
      promise.Reject("Unknown error downloading PDF");
    }
    co_return;
  }

  IAsyncAction SavePdfFileUIThread(IBuffer buffer, std::string suggestedName,
                                   ReactPromise<bool> promise) {
    try {
      winrt::Windows::Storage::Pickers::FileSavePicker savePicker;
      savePicker.SuggestedStartLocation(
          winrt::Windows::Storage::Pickers::PickerLocationId::Downloads);
      savePicker.FileTypeChoices().Insert(
          L"PDF Document",
          winrt::single_threaded_vector<winrt::hstring>({L".pdf"}));
      savePicker.SuggestedFileName(winrt::to_hstring(suggestedName));

      StorageFile file = co_await savePicker.PickSaveFileAsync();
      if (file != nullptr) {
        co_await FileIO::WriteBufferAsync(file, buffer);
        promise.Resolve(true);
      } else {
        promise.Resolve(false);
      }
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("Picker Error: " + winrt::to_string(ex.message())).c_str());
    } catch (...) {
      promise.Reject("Failed to save file from picker");
    }
  }

  IAsyncAction SaveFileAsync(std::string url, std::string suggestedName,
                             std::string fileTypeLabel, std::string extension,
                             std::string authToken,
                             ReactPromise<bool> promise) {
    try {
      HttpClient client;
      if (!authToken.empty()) {
        client.DefaultRequestHeaders().TryAppendWithoutValidation(
            L"Authorization", winrt::to_hstring("Bearer " + authToken));
      }
      Uri uri{winrt::to_hstring(url)};
      HttpResponseMessage response = co_await client.GetAsync(uri);
      if (!response.IsSuccessStatusCode()) {
        promise.Reject(
            ("HTTP error: " + std::to_string((int)response.StatusCode()))
                .c_str());
        co_return;
      }
      IBuffer buffer = co_await response.Content().ReadAsBufferAsync();

      auto dispatcher =
          winrt::Windows::ApplicationModel::Core::CoreApplication::MainView()
              .CoreWindow()
              .Dispatcher();
      dispatcher.RunAsync(
          winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
          [this, buffer, suggestedName, fileTypeLabel, extension, promise]() {
            SaveFileUIThread(buffer, suggestedName, fileTypeLabel, extension,
                             promise);
          });
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("WinRT Error: " + winrt::to_string(ex.message())).c_str());
    } catch (std::exception const &ex) {
      promise.Reject(("Std Error: " + std::string(ex.what())).c_str());
    } catch (...) {
      promise.Reject("Unknown error downloading file");
    }
    co_return;
  }

  IAsyncAction SaveFileUIThread(IBuffer buffer, std::string suggestedName,
                                std::string fileTypeLabel,
                                std::string extension,
                                ReactPromise<bool> promise) {
    try {
      winrt::Windows::Storage::Pickers::FileSavePicker savePicker;
      savePicker.SuggestedStartLocation(
          winrt::Windows::Storage::Pickers::PickerLocationId::Downloads);

      winrt::hstring wLabel = winrt::to_hstring(fileTypeLabel);
      winrt::hstring wExt = winrt::to_hstring(extension);
      savePicker.FileTypeChoices().Insert(
          wLabel, winrt::single_threaded_vector<winrt::hstring>({wExt}));
      savePicker.SuggestedFileName(winrt::to_hstring(suggestedName));

      StorageFile file = co_await savePicker.PickSaveFileAsync();
      if (file != nullptr) {
        co_await FileIO::WriteBufferAsync(file, buffer);
        promise.Resolve(true);
      } else {
        promise.Resolve(false);
      }
    } catch (winrt::hresult_error const &ex) {
      promise.Reject(
          ("Picker Error: " + winrt::to_string(ex.message())).c_str());
    } catch (...) {
      promise.Reject("Failed to save file from picker");
    }
  }
};
} // namespace JKErpWindows
} // namespace winrt
