// Windows/Window.cpp

#include "StdAfx.h"

#ifndef _UNICODE
#include "Common/StringConvert.h"
#endif
#include "Windows/Window.h"

#ifndef _UNICODE
extern bool g_IsNT;
#endif

namespace NWindows {

#ifndef _UNICODE
ATOM MyRegisterClass(CONST WNDCLASSW *wndClass)
{
  if (g_IsNT)
    return RegisterClassW(wndClass);
  WNDCLASSA wndClassA;
  wndClassA.style = wndClass->style; 
  wndClassA.lpfnWndProc = wndClass->lpfnWndProc; 
  wndClassA.cbClsExtra = wndClass->cbClsExtra; 
  wndClassA.cbWndExtra = wndClass->cbWndExtra; 
  wndClassA.hInstance = wndClass->hInstance; 
  wndClassA.hIcon = wndClass->hIcon; 
  wndClassA.hCursor = wndClass->hCursor; 
  wndClassA.hbrBackground = wndClass->hbrBackground; 
  AString menuName;
  AString className;
  if (IS_INTRESOURCE(wndClass->lpszMenuName))
    wndClassA.lpszMenuName = (LPCSTR)wndClass->lpszMenuName;
  else
  {
    menuName = GetSystemString(wndClass->lpszMenuName);
    wndClassA.lpszMenuName = menuName;
  }
  if (IS_INTRESOURCE(wndClass->lpszClassName))
    wndClassA.lpszClassName = (LPCSTR)wndClass->lpszClassName;
  else
  {
    className = GetSystemString(wndClass->lpszClassName);
    wndClassA.lpszClassName = className;
  }
  return RegisterClassA(&wndClassA);
}

bool CWindow::Create(LPCWSTR className,
      LPCWSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam)
{
  if (g_IsNT)
  {
    _window = ::CreateWindowW(className, windowName,
        style, x, y, width, height, parentWindow, 
        idOrHMenu, instance, createParam);
     return (_window != NULL);
  }
  return Create(GetSystemString(className), GetSystemString(windowName),
        style, x, y, width, height, parentWindow, 
        idOrHMenu, instance, createParam);
}

bool CWindow::CreateEx(DWORD exStyle, LPCWSTR className,
      LPCWSTR windowName, DWORD style,
      int x, int y, int width, int height,
      HWND parentWindow, HMENU idOrHMenu, 
      HINSTANCE instance, LPVOID createParam)
{
  if (g_IsNT)
  {
    _window = ::CreateWindowExW(exStyle, className, windowName,
      style, x, y, width, height, parentWindow, 
      idOrHMenu, instance, createParam);
     return (_window != NULL);
  }
  AString classNameA;
  LPCSTR classNameP;
  if (IS_INTRESOURCE(className))
    classNameP = (LPCSTR)className;
  else
  {
    classNameA = GetSystemString(className);
    classNameP = classNameA;
  }
  AString windowNameA;
  LPCSTR windowNameP;
  if (IS_INTRESOURCE(windowName))
    windowNameP = (LPCSTR)windowName;
  else
  {
    windowNameA = GetSystemString(windowName);
    windowNameP = windowNameA;
  }
  return CreateEx(exStyle, classNameP, windowNameP,
      style, x, y, width, height, parentWindow, 
      idOrHMenu, instance, createParam);
}

#endif

#ifndef _UNICODE
bool MySetWindowText(HWND wnd, LPCWSTR s)
{ 
  if (g_IsNT)
    return BOOLToBool(::SetWindowTextW(wnd, s));
  return BOOLToBool(::SetWindowTextA(wnd, UnicodeStringToMultiByte(s)));
}
#endif 

bool CWindow::GetText(CSysString &s)
{
  s.Empty();
  int length = GetTextLength();
  if (length == 0)
    return (::GetLastError() == ERROR_SUCCESS);
  length = GetText(s.GetBuffer(length), length + 1);
  s.ReleaseBuffer();
  if (length == 0)
    return (::GetLastError() != ERROR_SUCCESS);
  return true;
}

#ifndef _UNICODE
bool CWindow::GetText(UString &s)
{
  if (g_IsNT)
  {
    s.Empty();
    int length = GetWindowTextLengthW(_window);
    if (length == 0)
      return (::GetLastError() == ERROR_SUCCESS);
    length = GetWindowTextW(_window, s.GetBuffer(length), length + 1);
    s.ReleaseBuffer();
    if (length == 0)
      return (::GetLastError() == ERROR_SUCCESS);
    return true;
  }
  CSysString sysString;
  bool result = GetText(sysString);
  s = GetUnicodeString(sysString);
  return result;
}
#endif

 
/*
bool CWindow::ModifyStyleBase(int styleOffset,
  DWORD remove, DWORD add, UINT flags)
{
  DWORD style = GetWindowLong(styleOffset);
  DWORD newStyle = (style & ~remove) | add;
  if (style == newStyle)
    return false; // it is not good 

  SetWindowLong(styleOffset, newStyle);
  if (flags != 0)
  {
    ::SetWindowPos(_window, NULL, 0, 0, 0, 0,
      SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | flags);
  }
  return TRUE;
}
*/

}
