// Windows/Control/Dialog.cpp

#include "StdAfx.h"

#ifndef _UNICODE
#include "Common/StringConvert.h"
#endif
#include "Windows/Control/Dialog.h"

extern HINSTANCE g_hInstance;
#ifndef _UNICODE
extern bool g_IsNT;
#endif

namespace NWindows {
namespace NControl {

static INT_PTR APIENTRY DialogProcedure(HWND dialogHWND, UINT message, 
    WPARAM wParam, LPARAM lParam)
{
  CWindow dialogTmp(dialogHWND);
  if (message == WM_INITDIALOG)
    dialogTmp.SetUserDataLongPtr(lParam);
  CDialog *dialog = (CDialog *)(dialogTmp.GetUserDataLongPtr());
  if (dialog == NULL)
    return FALSE;
  if (message == WM_INITDIALOG)
    dialog->Attach(dialogHWND);

  return BoolToBOOL(dialog->OnMessage(message, wParam, lParam));
}

bool CDialog::OnMessage(UINT message, WPARAM wParam, LPARAM lParam)
{
  switch (message)
  {
    case WM_INITDIALOG:
      return OnInit();
    case WM_COMMAND:
      return OnCommand(wParam, lParam);
    case WM_NOTIFY:
      return OnNotify(wParam, (LPNMHDR) lParam);
    case WM_HELP:
      {
        OnHelp((LPHELPINFO)lParam);
        return true;
      }
    case WM_TIMER:
      {
        return OnTimer(wParam, lParam);
      }
    default:
      return false;
  }
}

bool CDialog::OnCommand(WPARAM wParam, LPARAM lParam) 
{ 
  return OnCommand(HIWORD(wParam), LOWORD(wParam), lParam);
}

bool CDialog::OnCommand(int code, int itemID, LPARAM lParam)
{
  if (code == BN_CLICKED)
    return OnButtonClicked(itemID, (HWND)lParam);
  return false; 
}

bool CDialog::OnButtonClicked(int buttonID, HWND buttonHWND) 
{ 
  switch(buttonID)
  {
    case IDOK:
      OnOK();
      break;
    case IDCANCEL:
      OnCancel();
      break;
    case IDHELP:
      OnHelp();
      break;
    default:
      return false;
  }
  return true;
}

bool CModelessDialog::Create(LPCTSTR templateName, HWND parentWindow)
{ 
  HWND aHWND = CreateDialogParam(g_hInstance, templateName, parentWindow, DialogProcedure, (LPARAM)this);
  if (aHWND == 0)
    return false;
  Attach(aHWND);
  return true;
}

INT_PTR CModalDialog::Create(LPCTSTR templateName, HWND parentWindow)
{ 
  return DialogBoxParam(g_hInstance, templateName, parentWindow, DialogProcedure, (LPARAM)this);
}

#ifndef _UNICODE

bool CModelessDialog::Create(LPCWSTR templateName, HWND parentWindow)
{ 
  HWND aHWND;
  if (g_IsNT)
    aHWND = CreateDialogParamW(g_hInstance, templateName, parentWindow, DialogProcedure, (LPARAM)this);
  else
  {
    AString name;
    LPCSTR templateNameA;
    if (IS_INTRESOURCE(templateName))
      templateNameA = (LPCSTR)templateName;
    else
    {
      name = GetSystemString(templateName);
      templateNameA = name;
    }
    aHWND = CreateDialogParamA(g_hInstance, templateNameA, parentWindow, DialogProcedure, (LPARAM)this);
  }
  if (aHWND == 0)
    return false;
  Attach(aHWND);
  return true;
}

INT_PTR CModalDialog::Create(LPCWSTR templateName, HWND parentWindow)
{ 
  if (g_IsNT)
    return DialogBoxParamW(g_hInstance, templateName, parentWindow, DialogProcedure, (LPARAM)this);
  AString name;
  LPCSTR templateNameA;
  if (IS_INTRESOURCE(templateName))
    templateNameA = (LPCSTR)templateName;
  else
  {
    name = GetSystemString(templateName);
    templateNameA = name;
  }
  return DialogBoxParamA(g_hInstance, templateNameA, parentWindow, DialogProcedure, (LPARAM)this);
}
#endif 

}}
