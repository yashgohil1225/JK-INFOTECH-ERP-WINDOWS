#include "pch.h"
#include "ReactPackageProvider.h"
#include "PdfRendererModule.h"

using namespace winrt::Microsoft::ReactNative;

namespace winrt::JKErpWindows::implementation
{

void ReactPackageProvider::CreatePackage(IReactPackageBuilder const &packageBuilder) noexcept
{
    AddAttributedModules(packageBuilder, true);
    packageBuilder.AddModule(L"PdfRenderer", winrt::Microsoft::ReactNative::MakeModuleProvider<winrt::JKErpWindows::PdfRenderer>());
}

} // namespace winrt::JKErpWindows::implementation
