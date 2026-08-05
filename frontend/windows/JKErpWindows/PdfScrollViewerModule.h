// =============================================================
// JK INFOTECH ERP — Native XAML PDF ScrollViewer ViewManager
// File : windows/JKErpWindows/PdfScrollViewerModule.h
//
// Implements the Tally ERP + Adobe Acrobat pattern:
//   • XAML ScrollViewer handles ALL zoom/pan/scroll natively
//   • Ctrl+Wheel, pinch-to-zoom, two-finger trackpad = free from XAML
//   • React Native JS only manages pages (file paths) and toolbar UI
//   • Zero JS state involved during zoom/scroll = zero crash risk
// =============================================================

#pragma once

#if defined(__clang__)
#include <coroutine>
#define _RESUMABLE_FUNCTIONS_SUPPORTED 0
#define _HAS_EXPERIMENTAL_COROUTINE_MEMBERS 0
#endif

#include "pch.h"
#include <NativeModules.h>
#if __has_include(<winrt/Microsoft.ReactNative.h>)
#include <winrt/Microsoft.ReactNative.h>
#endif
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Storage.h>
#include <winrt/Windows.Storage.Streams.h>
#include <winrt/Windows.System.h>
#include <winrt/Windows.UI.Core.h>
#include <winrt/Windows.UI.Input.h>
#include <winrt/Windows.UI.Xaml.Controls.h>
#include <winrt/Windows.UI.Xaml.Input.h>
#include <winrt/Windows.UI.Xaml.Media.Imaging.h>
#include <winrt/Windows.UI.Xaml.Media.h>
#include <winrt/Windows.UI.Xaml.h>
#include <algorithm>
#include <mutex>
#include <optional>
#include <string>
#include <vector>

using namespace winrt::Microsoft::ReactNative;
using namespace winrt::Windows::Foundation;
using namespace winrt::Windows::Foundation::Collections;
using namespace winrt::Windows::Storage;
using namespace winrt::Windows::Storage::Streams;
using namespace winrt::Windows::UI::Xaml;
using namespace winrt::Windows::UI::Xaml::Controls;
using namespace winrt::Windows::UI::Xaml::Media;
using namespace winrt::Windows::UI::Xaml::Media::Imaging;

namespace winrt {
namespace JKErpWindows {

// ─────────────────────────────────────────────────────────────────────────────
// PdfScrollViewerViewManager
// Implements the XAML native ScrollViewer for PDF page display.
// Only one PDF viewer is ever open at a time in the ERP, so we use safe
// static state for simplicity and performance.
// ─────────────────────────────────────────────────────────────────────────────
struct PdfScrollViewerViewManager : winrt::implements<
    PdfScrollViewerViewManager,
    IViewManager,
    IViewManagerWithReactContext,
    IViewManagerWithNativeProperties,
    IViewManagerWithCommands,
    IViewManagerWithExportedEventTypeConstants>
{
private:
    IReactContext m_reactContext{ nullptr };

    // ── Static per-app state ─────────────────────────────────────────────────
    // One PDF viewer open at a time → static is safe and fast.
    static std::mutex s_mutex;
    static std::vector<std::wstring> s_pages;
    static double s_pageWidth;
    static double s_pageHeight;
    static winrt::weak_ref<ScrollViewer> s_scrollViewerWeak;
    static winrt::weak_ref<FrameworkElement> s_rootViewWeak;

public:
    // ── IViewManagerWithReactContext ──────────────────────────────────────────
    IReactContext ReactContext() noexcept { return m_reactContext; }
    void ReactContext(IReactContext const& value) noexcept { m_reactContext = value; }

    // ── IViewManager ─────────────────────────────────────────────────────────
    hstring Name() noexcept { return L"PdfScrollViewer"; }

    FrameworkElement CreateView() noexcept {
        try {
            // ── Page stack panel (vertical list of PDF pages) ───────────────
            StackPanel panel;
            panel.Orientation(Orientation::Vertical);
            panel.Spacing(20.0);
            panel.Padding(ThicknessHelper::FromUniformLength(24.0));
            panel.Background(nullptr);  // transparent
            // Left-align so landscape pages wider than viewport are scrollable (not clipped)
            panel.HorizontalAlignment(HorizontalAlignment::Left);

            // ── ScrollViewer with native Tally/Acrobat-style zoom ───────────
            // ZoomMode::Enabled gives us for FREE:
            //   • Ctrl + Mouse Wheel  → zoom in/out
            //   • Two-finger pinch   → zoom in/out
            //   • Two-finger swipe   → scroll (horizontal & vertical)
            //   • Native scroll bars → auto appear when needed
            ScrollViewer sv;
            sv.ZoomMode(ZoomMode::Enabled);
            sv.MinZoomFactor(0.25f);
            sv.MaxZoomFactor(4.0f);
            sv.HorizontalScrollMode(ScrollMode::Enabled);
            sv.VerticalScrollMode(ScrollMode::Enabled);
            sv.HorizontalScrollBarVisibility(ScrollBarVisibility::Auto);
            sv.VerticalScrollBarVisibility(ScrollBarVisibility::Auto);
            sv.IsHorizontalRailEnabled(false);  // Allow diagonal scrolling
            sv.IsVerticalRailEnabled(false);
            sv.HorizontalAlignment(HorizontalAlignment::Stretch);
            sv.VerticalAlignment(VerticalAlignment::Stretch);
            sv.Content(panel);

            // ── Explicit PointerWheelChanged handler for Ctrl + Mouse Wheel & Trackpad ──
            sv.PointerWheelChanged([](IInspectable const& sender, winrt::Windows::UI::Xaml::Input::PointerRoutedEventArgs const& args) noexcept {
                try {
                    auto scrollViewer = sender.as<ScrollViewer>();
                    auto point = args.GetCurrentPoint(scrollViewer);
                    auto props = point.Properties();
                    int delta = props.MouseWheelDelta();

                    auto window = winrt::Windows::UI::Core::CoreWindow::GetForCurrentThread();
                    bool isCtrl = false;
                    if (window) {
                        auto ctrlState = window.GetKeyState(winrt::Windows::System::VirtualKey::Control);
                        isCtrl = (ctrlState & winrt::Windows::UI::Core::CoreVirtualKeyStates::Down) == winrt::Windows::UI::Core::CoreVirtualKeyStates::Down;
                    }

                    if (isCtrl && delta != 0) {
                        float currentZoom = scrollViewer.ZoomFactor();
                        float factor = delta > 0 ? 1.15f : (1.0f / 1.15f);
                        float newZoom = std::min(4.0f, std::max(0.25f, currentZoom * factor));

                        auto boxF = [](float val) { return winrt::box_value(val).as<winrt::Windows::Foundation::IReference<float>>(); };
                        scrollViewer.ChangeView(nullptr, nullptr, boxF(newZoom));
                        args.Handled(true);
                    }
                } catch (...) {}
            });

            // ── Root border container ────────────────────────────────────────
            Border root;
            root.HorizontalAlignment(HorizontalAlignment::Stretch);
            root.VerticalAlignment(VerticalAlignment::Stretch);
            root.Child(sv);

            // ── Store references for prop updates and commands ───────────────
            {
                std::lock_guard lock(s_mutex);
                s_scrollViewerWeak = winrt::make_weak(sv);
                s_rootViewWeak = winrt::make_weak(root.as<FrameworkElement>());
            }

            // ── Subscribe to ViewChanged for zoom % display in JS toolbar ───
            // Adobe Acrobat pattern: native fires event → JS updates display only
            auto reactCtx = m_reactContext;
            sv.ViewChanged([reactCtx](IInspectable const& sender, ScrollViewerViewChangedEventArgs const& args) noexcept {
                try {
                    // Skip intermediate animation frames — only fire on final zoom
                    if (args.IsIntermediate()) return;
                    if (!reactCtx) return;

                    auto scrollViewer = sender.as<ScrollViewer>();
                    float zoom = scrollViewer.ZoomFactor();

                    // Retrieve the root view from static weak ref
                    winrt::Windows::UI::Xaml::FrameworkElement rootView{ nullptr };
                    {
                        std::lock_guard lock(s_mutex);
                        rootView = s_rootViewWeak.get();
                    }
                    if (!rootView) return;

                    // Dispatch onZoomChanged event to JS (just for displaying "125%" in toolbar)
                    reactCtx.DispatchEvent(rootView, L"topZoomChanged",
                        [zoom](IJSValueWriter const& writer) noexcept {
                            writer.WriteObjectBegin();
                            writer.WritePropertyName(L"zoom");
                            writer.WriteDouble(static_cast<double>(zoom));
                            writer.WriteObjectEnd();
                        });
                } catch (...) {}
            });

            return root;
        } catch (...) {
            return Border{};
        }
    }

    // ── IViewManagerWithNativeProperties ─────────────────────────────────────
    IMapView<hstring, ViewManagerPropertyType> NativeProps() noexcept {
        auto map = winrt::single_threaded_map<hstring, ViewManagerPropertyType>();
        map.Insert(L"pages",      ViewManagerPropertyType::Array);
        map.Insert(L"pageWidth",  ViewManagerPropertyType::Number);
        map.Insert(L"pageHeight", ViewManagerPropertyType::Number);
        return map.GetView();
    }

    void UpdateProperties(FrameworkElement const& /*view*/, IJSValueReader const& reader) noexcept {
        try {
            std::optional<double> newPageWidth;
            std::optional<double> newPageHeight;
            std::optional<std::vector<std::wstring>> newPages;

            hstring propName;
            while (reader.GetNextObjectProperty(propName)) {
                auto vtype = reader.ValueType();

                if (propName == L"pageWidth") {
                    if (vtype == JSValueType::Double) { double v = reader.GetDouble(); if (v > 0) newPageWidth = v; }
                    else if (vtype == JSValueType::Int64) { int64_t v = reader.GetInt64(); if (v > 0) newPageWidth = static_cast<double>(v); }

                } else if (propName == L"pageHeight") {
                    if (vtype == JSValueType::Double) { double v = reader.GetDouble(); if (v > 0) newPageHeight = v; }
                    else if (vtype == JSValueType::Int64) { int64_t v = reader.GetInt64(); if (v > 0) newPageHeight = static_cast<double>(v); }

                } else if (propName == L"pages" && vtype == JSValueType::Array) {
                    std::vector<std::wstring> pages;
                    while (reader.GetNextArrayItem()) {
                        if (reader.ValueType() == JSValueType::String) {
                            pages.emplace_back(reader.GetString().c_str());
                        }
                        // Skip non-string items (GetNextArrayItem already advanced)
                    }
                    newPages = std::move(pages);

                } else {
                    // Skip null/unknown props without reading value
                    // (RNW IJSValueReader auto-advances on next GetNext* call)
                }
            }

            bool changed = false;
            {
                std::lock_guard lock(s_mutex);
                if (newPageWidth)  { s_pageWidth  = *newPageWidth;  changed = true; }
                if (newPageHeight) { s_pageHeight = *newPageHeight; changed = true; }
                if (newPages)      { s_pages      = *newPages;      changed = true; }
            }

            if (changed) {
                auto sv = s_scrollViewerWeak.get();
                if (!sv) return;

                double pw, ph;
                std::vector<std::wstring> pages;
                {
                    std::lock_guard lock(s_mutex);
                    pw    = s_pageWidth;
                    ph    = s_pageHeight;
                    pages = s_pages;
                }

                // Rebuild page images on UI thread
                sv.Dispatcher().RunAsync(
                    winrt::Windows::UI::Core::CoreDispatcherPriority::Normal,
                    [sv, pages, pw, ph]() noexcept {
                        RebuildPages(sv, pages, pw, ph);
                    });
            }
        } catch (...) {}
    }

    // ── IViewManagerWithCommands ──────────────────────────────────────────────
    // Commands for the +/- zoom toolbar buttons in JS.
    // All computation happens on the XAML UI thread (Acrobat pattern).
    IVectorView<hstring> Commands() noexcept {
        auto vec = winrt::single_threaded_vector<hstring>();
        vec.Append(L"zoomIn");
        vec.Append(L"zoomOut");
        vec.Append(L"resetZoom");
        vec.Append(L"setZoom");    // args: [scale: number]
        vec.Append(L"fitWidth");   // args: [containerWidth: number]
        return vec.GetView();
    }

    void DispatchCommand(FrameworkElement const& /*view*/, hstring const& commandName,
                         IJSValueReader const& args) noexcept {
        try {
            // Read any args synchronously (before the function returns)
            double setZoomValue = 1.0;
            double fitWidthContainerW = 0.0;

            if (commandName == L"setZoom") {
                if (args.GetNextArrayItem() && args.ValueType() == JSValueType::Double) {
                    setZoomValue = args.GetDouble();
                }
            } else if (commandName == L"fitWidth") {
                if (args.GetNextArrayItem() && args.ValueType() == JSValueType::Double) {
                    fitWidthContainerW = args.GetDouble();
                }
            }

            auto sv = s_scrollViewerWeak.get();
            if (!sv) return;

            std::wstring cmd(commandName.c_str());
            sv.Dispatcher().RunAsync(
                winrt::Windows::UI::Core::CoreDispatcherPriority::High,
                [sv, cmd, setZoomValue, fitWidthContainerW]() noexcept {
                    try {
                        auto boxF = [](float val) { return winrt::box_value(val).as<winrt::Windows::Foundation::IReference<float>>(); };
                        auto boxD = [](double val) { return winrt::box_value(val).as<winrt::Windows::Foundation::IReference<double>>(); };

                        if (cmd == L"zoomIn") {
                            float newZoom = std::min(4.0f, sv.ZoomFactor() * 1.15f);
                            sv.ChangeView(nullptr, nullptr, boxF(newZoom));
                        } else if (cmd == L"zoomOut") {
                            float newZoom = std::max(0.25f, sv.ZoomFactor() / 1.15f);
                            sv.ChangeView(nullptr, nullptr, boxF(newZoom));
                        } else if (cmd == L"resetZoom") {
                            sv.ChangeView(
                                boxD(0.0),   // scroll to left
                                boxD(0.0),   // scroll to top
                                boxF(1.0f)   // 100% zoom
                            );
                        } else if (cmd == L"setZoom") {
                            float clamped = static_cast<float>(std::min(4.0, std::max(0.25, setZoomValue)));
                            sv.ChangeView(nullptr, nullptr, boxF(clamped));
                        } else if (cmd == L"fitWidth") {
                            double pageW = 0.0;
                            { std::lock_guard lock(s_mutex); pageW = s_pageWidth; }
                            if (pageW > 0 && fitWidthContainerW > 0) {
                                float fitZoom = static_cast<float>((fitWidthContainerW - 48.0) / pageW);
                                fitZoom = std::min(4.0f, std::max(0.25f, fitZoom));
                                sv.ChangeView(nullptr, nullptr, boxF(fitZoom));
                            }
                        }
                    } catch (...) {}
                });
        } catch (...) {}
    }

    // ── IViewManagerWithExportedEventTypeConstants ────────────────────────────
    ConstantProviderDelegate ExportedCustomBubblingEventTypeConstants() noexcept {
        return nullptr;
    }

    ConstantProviderDelegate ExportedCustomDirectEventTypeConstants() noexcept {
        return ConstantProviderDelegate([](IJSValueWriter const& writer) noexcept {
            // topZoomChanged → JS prop "onZoomChanged"
            writer.WritePropertyName(L"topZoomChanged");
            writer.WriteObjectBegin();
            writer.WritePropertyName(L"registrationName");
            writer.WriteString(L"onZoomChanged");
            writer.WriteObjectEnd();
        });
    }

private:
    // ── Page rebuild (runs on XAML UI thread) ─────────────────────────────────
    static void RebuildPages(
        ScrollViewer const& sv,
        std::vector<std::wstring> const& pages,
        double pageWidth,
        double pageHeight) noexcept
    {
        try {
            auto panel = sv.Content().as<StackPanel>();
            uint32_t currentCount = panel.Children().Size();

            if (currentCount == pages.size() && currentCount > 0) {
                // In-place smooth bitmap update — ZERO white flash / ZERO blinking!
                for (uint32_t i = 0; i < pages.size(); ++i) {
                    auto border = panel.Children().GetAt(i).try_as<Border>();
                    if (border) {
                        border.HorizontalAlignment(HorizontalAlignment::Left);
                        if (pageWidth > 0 && pageHeight > 0) {
                            border.Width(pageWidth);
                            border.Height(pageHeight);
                        }
                        auto imgCtrl = border.Child().try_as<Image>();
                        if (imgCtrl) {
                            if (pageWidth > 0 && pageHeight > 0) {
                                imgCtrl.Width(pageWidth);
                                imgCtrl.Height(pageHeight);
                            }
                            imgCtrl.Stretch(winrt::Windows::UI::Xaml::Media::Stretch::Uniform);
                            LoadBitmapAsync(imgCtrl, pages[i]);
                        }
                    }
                }
            } else {
                panel.Children().Clear();

                for (auto const& filePath : pages) {
                    // White paper card — left-aligned so landscape pages can be scrolled horizontally
                    Border pageBorder;
                    pageBorder.Background(SolidColorBrush(winrt::Windows::UI::Colors::White()));
                    pageBorder.BorderThickness(ThicknessHelper::FromUniformLength(0.5));
                    pageBorder.BorderBrush(SolidColorBrush(
                        winrt::Windows::UI::ColorHelper::FromArgb(255, 203, 213, 225)));
                    pageBorder.HorizontalAlignment(HorizontalAlignment::Left);
                    if (pageWidth > 0 && pageHeight > 0) {
                        pageBorder.Width(pageWidth);
                        pageBorder.Height(pageHeight);
                    }

                    // The page image (async loaded)
                    Image imgCtrl;
                    if (pageWidth > 0 && pageHeight > 0) {
                        imgCtrl.Width(pageWidth);
                        imgCtrl.Height(pageHeight);
                    }
                    imgCtrl.Stretch(winrt::Windows::UI::Xaml::Media::Stretch::Uniform);
                    imgCtrl.HorizontalAlignment(HorizontalAlignment::Stretch);
                    imgCtrl.VerticalAlignment(VerticalAlignment::Stretch);

                    pageBorder.Child(imgCtrl);
                    panel.Children().Append(pageBorder);

                    // Async image load — does not block UI
                    LoadBitmapAsync(imgCtrl, filePath);
                }
            }
        } catch (...) {}
    }

    // ── Async bitmap loader (Acrobat pattern: load async, show when ready) ────
    static winrt::fire_and_forget LoadBitmapAsync(Image imgCtrl, std::wstring filePath) noexcept {
        bool loaded = false;
        try {
            // Normalize path: strip "file:///" or "file://" prefix, convert all slashes to backslashes
            auto path = filePath;
            if (path.size() >= 8 && path.substr(0, 8) == L"file:///") {
                path = path.substr(8);
            } else if (path.size() >= 7 && path.substr(0, 7) == L"file://") {
                path = path.substr(7);
            }
            std::replace(path.begin(), path.end(), L'/', L'\\');

            // Load on background thread via StorageFile
            auto file = co_await StorageFile::GetFileFromPathAsync(winrt::hstring(path));
            auto stream = co_await file.OpenAsync(FileAccessMode::Read);

            // Switch to UI thread for bitmap decode + assignment
            co_await winrt::resume_foreground(imgCtrl.Dispatcher());

            BitmapImage bitmap;
            bitmap.ImageOpened([imgCtrl](IInspectable const& sender, RoutedEventArgs const&) noexcept {
                try {
                    auto bmp = sender.as<BitmapImage>();
                    int32_t pxW = bmp.PixelWidth();
                    int32_t pxH = bmp.PixelHeight();
                    if (pxW > 0 && pxH > 0) {
                        double aspect = static_cast<double>(pxW) / static_cast<double>(pxH);
                        double targetW = (aspect > 1.0) ? 1018.0 : 720.0;
                        double targetH = targetW / aspect;

                        imgCtrl.Width(targetW);
                        imgCtrl.Height(targetH);

                        auto parentObj = imgCtrl.Parent();
                        if (parentObj) {
                            auto border = parentObj.try_as<Border>();
                            if (border) {
                                border.Width(targetW);
                                border.Height(targetH);
                            }
                        }
                    }
                } catch (...) {}
            });

            co_await bitmap.SetSourceAsync(stream);
            imgCtrl.Source(bitmap);

            int32_t pxW = bitmap.PixelWidth();
            int32_t pxH = bitmap.PixelHeight();
            if (pxW > 0 && pxH > 0) {
                double aspect = static_cast<double>(pxW) / static_cast<double>(pxH);
                double targetW = (aspect > 1.0) ? 1018.0 : 720.0;
                double targetH = targetW / aspect;

                imgCtrl.Width(targetW);
                imgCtrl.Height(targetH);

                try {
                    auto parentObj = imgCtrl.Parent();
                    if (parentObj) {
                        auto border = parentObj.try_as<Border>();
                        if (border) {
                            border.Width(targetW);
                            border.Height(targetH);
                        }
                    }
                } catch (...) {}
            }
            loaded = true;
        } catch (...) {}

        if (!loaded) {
            // Fallback URI approach (not in catch block)
            try {
                auto uriStr = filePath;
                if (uriStr.find(L"file:///") == std::wstring::npos &&
                    uriStr.find(L"ms-appx") == std::wstring::npos) {
                    std::replace(uriStr.begin(), uriStr.end(), L'\\', L'/');
                    uriStr = L"file:///" + uriStr;
                }
                co_await winrt::resume_foreground(imgCtrl.Dispatcher());
                BitmapImage bitmap;
                bitmap.ImageOpened([imgCtrl](auto const& sender, auto const&) {
                    try {
                        auto bmp = sender.as<BitmapImage>();
                        int32_t pxW = bmp.PixelWidth();
                        int32_t pxH = bmp.PixelHeight();
                        if (pxW > 0 && pxH > 0) {
                            double aspect = static_cast<double>(pxW) / static_cast<double>(pxH);
                            double targetW = (aspect > 1.0) ? 1018.0 : 720.0;
                            double targetH = targetW / aspect;

                            imgCtrl.Width(targetW);
                            imgCtrl.Height(targetH);

                            auto parentObj = imgCtrl.Parent();
                            if (parentObj) {
                                auto border = parentObj.try_as<Border>();
                                if (border) {
                                    border.Width(targetW);
                                    border.Height(targetH);
                                }
                            }
                        }
                    } catch (...) {}
                });
                bitmap.UriSource(Uri(winrt::hstring(uriStr)));
                imgCtrl.Source(bitmap);
            } catch (...) {}
        }
    }
};

// ── Static member definitions ─────────────────────────────────────────────────
std::mutex PdfScrollViewerViewManager::s_mutex;
std::vector<std::wstring> PdfScrollViewerViewManager::s_pages;
double PdfScrollViewerViewManager::s_pageWidth  = 720.0;
double PdfScrollViewerViewManager::s_pageHeight = 1018.0;
winrt::weak_ref<ScrollViewer>     PdfScrollViewerViewManager::s_scrollViewerWeak;
winrt::weak_ref<FrameworkElement> PdfScrollViewerViewManager::s_rootViewWeak;

} // namespace JKErpWindows
} // namespace winrt
