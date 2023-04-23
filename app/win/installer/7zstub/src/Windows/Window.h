// Windows/Window.h

#ifndef __WINDOWS_WINDOW_H
#define __WINDOWS_WINDOW_H

#include "Windows/Defs.h"
#include "Common/String.h"

namespace NWindows {

inline ATOM MyRegisterClass(CONST WNDCLASS *wndClass)
  { return ::RegisterClass(wndClass); }

#ifndef _UNICODE
ATOM MyRegisterClass(CONST WNDCLASSW *wndClass);
#endif

#ifdef _UNICODE
inline bool MySetWindowText(HWND wnd, LPCWSTR s) { return BOOLToBool(::SetWindowText(wnd, s)); }
#else
bool MySetWindowText(HWND wnd, LPCWSTR s);
#endif



class CWindow
{
private:
   // bool ModifyStyleBase(int styleOffset, DWORD remove, DWORD add, UINT flags);
protected:
  HWND _window;
public:
  CWindow(HWND newWindow = NULL): _window(newWindow){};
  CWindow& operator=(HWND newWindow)
  {
    _window = newWindow;
    return *this;
  }
  operator HWND() const { return _window; }
  void Attach(HWND newWindow) { _window = newWindow; }
  HWND Detach()
  {
    HWND window = _window;
    _window = NULL;
    return window;
  }

  HWND GetParent() const { return ::GetParent(_window); }
  bool GetWindowRect(LPRECT rect) const { return BOOLToBool(::GetWindowRect(_window,rect )); }
  bool IsZoomed() const { return BOOLToBool(::IsZoomed(_window)); }
  bool ClientToScreen(LPPOINT point) const { return BOOLToBool(::ClientToScreen(_window, point)); }
  bool ScreenToClient(LPPOINT point) const { return BOOLToBool(::ScreenToClient(_window, point)); }

  bool CreateEx(DWORD exStyle, LPCTSTR className,
      LPCTSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam)
  {
    _window = ::CreateWindowEx(exStyle, className, windowName,
      style, x, y, width, height, parentWindow, 
      idOrHMenu, instance, createParam);
    return (_window != NULL);
  }

  bool Create(LPCTSTR className,
      LPCTSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam)
  {
    _window = ::CreateWindow(className, windowName,
      style, x, y, width, height, parentWindow, 
      idOrHMenu, instance, createParam);
    return (_window != NULL);
  }

  #ifndef _UNICODE
  bool Create(LPCWSTR className,
      LPCWSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam);
  bool CreateEx(DWORD exStyle, LPCWSTR className,
      LPCWSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam);
  #endif


  bool Destroy()
  {
    if (_window == NULL)
      return true;
    bool result = BOOLToBool(::DestroyWindow(_window));
    if(result)
      _window = NULL;
    return result;
  }
  bool IsWindow() {  return BOOLToBool(::IsWindow(_window)); }
  bool Move(int x, int y, int width, int height, bool repaint = true)
    { return BOOLToBool(::MoveWindow(_window, x, y, width, height, BoolToBOOL(repaint))); }
  bool GetClientRect(LPRECT rect) { return BOOLToBool(::GetClientRect(_window, rect)); }
  bool Show(int cmdShow) { return BOOLToBool(::ShowWindow(_window, cmdShow)); }
  bool SetPlacement(CONST WINDOWPLACEMENT *placement) { return BOOLToBool(::SetWindowPlacement(_window, placement)); }
  bool GetPlacement(WINDOWPLACEMENT *placement) { return BOOLToBool(::GetWindowPlacement(_window, placement)); }
  bool Update() { return BOOLToBool(::UpdateWindow(_window)); }
  bool InvalidateRect(LPCRECT rect, bool backgroundErase = true)
    { return BOOLToBool(::InvalidateRect(_window, rect, BoolToBOOL(backgroundErase))); }
  void SetRedraw(bool redraw = true) { SendMessage(WM_SETREDRAW, BoolToBOOL(redraw), 0); }

  #ifndef _WIN32_WCE
  LONG SetStyle(LONG_PTR style)
    { return SetLongPtr(GWL_STYLE, style); }
  DWORD GetStyle( ) const
    { return GetLongPtr(GWL_STYLE); }
  #else
  LONG SetStyle(LONG_PTR style)
    { return SetLong(GWL_STYLE, style); }
  DWORD GetStyle( ) const
    { return GetLong(GWL_STYLE); }
  #endif

  LONG_PTR SetLong(int index, LONG_PTR newLongPtr )
    { return ::SetWindowLong(_window, index, newLongPtr); }
  LONG_PTR GetLong(int index) const
    { return ::GetWindowLong(_window, index ); }
  LONG_PTR SetUserDataLong(LONG_PTR newLongPtr )
    { return SetLong(GWLP_USERDATA, newLongPtr); } 
  LONG_PTR GetUserDataLong() const
    { return GetLong(GWLP_USERDATA); }

  #ifndef _WIN32_WCE
  LONG_PTR SetLongPtr(int index, LONG_PTR newLongPtr )
    { return ::SetWindowLongPtr(_window, index, newLongPtr); }
  #ifndef _UNICODE
  LONG_PTR SetLongPtrW(int index, LONG_PTR newLongPtr )
    { return ::SetWindowLongPtrW(_window, index, newLongPtr); }
  #endif

  LONG_PTR GetLongPtr(int index) const
    { return ::GetWindowLongPtr(_window, index ); }
  LONG_PTR SetUserDataLongPtr(LONG_PTR newLongPtr )
    { return SetLongPtr(GWLP_USERDATA, newLongPtr); }
  LONG_PTR GetUserDataLongPtr() const
    { return GetLongPtr(GWLP_USERDATA); }
  #endif
  
  /*
  bool ModifyStyle(HWND hWnd, DWORD remove, DWORD add, UINT flags = 0)
    {  return ModifyStyleBase(GWL_STYLE, remove, add, flags); }
  bool ModifyStyleEx(HWND hWnd, DWORD remove, DWORD add, UINT flags = 0)
    { return ModifyStyleBase(GWL_EXSTYLE, remove, add, flags); }
  */
 
  HWND SetFocus() { return ::SetFocus(_window); }

  LRESULT SendMessage(UINT message, WPARAM wParam = 0, LPARAM lParam = 0)
    { return ::SendMessage(_window, message, wParam, lParam) ;}
  #ifndef _UNICODE
  LRESULT SendMessageW(UINT message, WPARAM wParam = 0, LPARAM lParam = 0)
    { return ::SendMessageW(_window, message, wParam, lParam) ;}
  #endif

  bool PostMessage(UINT message, WPARAM wParam = 0, LPARAM lParam = 0)
    {  return BOOLToBool(::PostMessage(_window, message, wParam, lParam)) ;}
  #ifndef _UNICODE
  LRESULT PostMessageW(UINT message, WPARAM wParam = 0, LPARAM lParam = 0)
    { return ::PostMessageW(_window, message, wParam, lParam) ;}
  #endif

  bool SetText(LPCTSTR s) { return BOOLToBool(::SetWindowText(_window, s)); }
  #ifndef _UNICODE
  bool CWindow::SetText(LPCWSTR s) { return MySetWindowText(_window, s); }
  #endif

  int GetTextLength() const 
    { return GetWindowTextLength(_window); }
  UINT GetText(LPTSTR string, int maxCount) const
    { return GetWindowText(_window, string, maxCount); }
  bool GetText(CSysString &s);
  #ifndef _UNICODE
  /*
  UINT GetText(LPWSTR string, int maxCount) const
    { return GetWindowTextW(_window, string, maxCount); }
  */
  bool GetText(UString &s);
  #endif

  bool Enable(bool enable)
    { return BOOLToBool(::EnableWindow(_window, BoolToBOOL(enable))); }
  
  bool IsEnabled()
    { return BOOLToBool(::IsWindowEnabled(_window)); }
  
  #ifndef _WIN32_WCE
  HMENU GetSystemMenu(bool revert)
    { return ::GetSystemMenu(_window, BoolToBOOL(revert)); }
  #endif

  UINT_PTR SetTimer(UINT_PTR idEvent, UINT elapse, TIMERPROC timerFunc = 0)
    { return ::SetTimer(_window, idEvent, elapse, timerFunc); }
  bool KillTimer(UINT_PTR idEvent)
    {return BOOLToBool(::KillTimer(_window, idEvent)); }
};

}

#endif

