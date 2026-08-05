#pragma once

#define NOMINMAX

#if defined(__clang__)
#include <coroutine>
#define _RESUMABLE_FUNCTIONS_SUPPORTED 0
#define _HAS_EXPERIMENTAL_COROUTINE_MEMBERS 0
#endif

#include <hstring.h>
#include <restrictederrorinfo.h>
#include <unknwn.h>
#include <windows.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Collections.h>
#include <winrt/Windows.ApplicationModel.Activation.h>
#include <winrt/Windows.UI.Xaml.h>
#include <winrt/Windows.UI.Xaml.Controls.h>
#if __has_include(<CppWinRTIncludes.h>)
#include <CppWinRTIncludes.h>
#endif
#if __has_include(<VersionMacros.h>)
#include <VersionMacros.h>
#endif
#if __has_include(<UI.Xaml.Controls.Primitives.h>)
#include <UI.Xaml.Controls.Primitives.h>
#include <UI.Xaml.Controls.h>
#include <UI.Xaml.Markup.h>
#include <UI.Xaml.Navigation.h>
#endif

#if __has_include(<winrt/Microsoft.ReactNative.h>)
#include <winrt/Microsoft.ReactNative.h>
#endif

#if __has_include(<winrt/Microsoft.UI.Xaml.Controls.h>)
#include <winrt/Microsoft.UI.Xaml.Automation.Peers.h>
#include <winrt/Microsoft.UI.Xaml.Controls.Primitives.h>
#include <winrt/Microsoft.UI.Xaml.Controls.h>
#include <winrt/Microsoft.UI.Xaml.Media.h>
#include <winrt/Microsoft.UI.Xaml.XamlTypeInfo.h>
#endif
using namespace winrt::Windows::Foundation;
