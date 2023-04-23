// Windows/Control/Dialog.h

#ifndef __WINDOWS_CONTROL_DIALOG_H
#define __WINDOWS_CONTROL_DIALOG_H

#include "Windows/Window.h"
#include "Windows/Defs.h"

namespace NWindows {
namespace NControl {

class CDialog: public CWindow
{
public:
  CDialog(HWND wndow = NULL): CWindow(wndow){};
  virtual ~CDialog() {};

  HWND GetItem(int itemID) const
    { return GetDlgItem(_window, itemID); }

  bool EnableItem(int itemID, bool enable) const
    { return BOOLToBool(::EnableWindow(GetItem(itemID), BoolToBOOL(enable))); }

  bool SetItemText(int itemID, LPCTSTR s)
    { return BOOLToBool(SetDlgItemText(_window, itemID, s)); }

  #ifndef _UNICODE
  bool SetItemText(int itemID, LPCWSTR s)
  { 
    CWindow window(GetItem(itemID));
    return window.SetText(s); 
  }
  #endif

  UINT GetItemText(int itemID, LPTSTR string, int maxCount)
    { return GetDlgItemText(_window, itemID, string, maxCount); }
  #ifndef _UNICODE
  /*
  bool GetItemText(int itemID, LPWSTR string, int maxCount)
  { 
    CWindow window(GetItem(itemID));
    return window.GetText(string, maxCount); 
  }
  */
  #endif

  bool SetItemInt(int itemID, UINT value, bool isSigned)
    { return BOOLToBool(SetDlgItemInt(_window, itemID, value, BoolToBOOL(isSigned))); }
  bool GetItemInt(int itemID, bool isSigned, UINT &value)
    { 
      BOOL result;
      value = GetDlgItemInt(_window, itemID, &result, BoolToBOOL(isSigned));
      return BOOLToBool(result);
    }

  HWND GetNextGroupItem(HWND control, bool previous)
    { return GetNextDlgGroupItem(_window, control, BoolToBOOL(previous)); }
  HWND GetNextTabItem(HWND control, bool previous)
    { return GetNextDlgTabItem(_window, control, BoolToBOOL(previous)); }

  bool MapRect(LPRECT rect)
    { return BOOLToBool(MapDialogRect(_window, rect)); }

  bool IsMessage(LPMSG message)
    { return BOOLToBool(IsDialogMessage(_window, message)); }

  LRESULT SendItemMessage(int itemID, UINT message, WPARAM wParam, LPARAM lParam)
    { return SendDlgItemMessage(_window, itemID, message, wParam, lParam); }

  bool CheckButton(int buttonID, UINT checkState)
    { return BOOLToBool(CheckDlgButton(_window, buttonID, checkState)); }
  bool CheckButton(int buttonID, bool checkState)
    { return CheckButton(buttonID, UINT(checkState ? BST_CHECKED : BST_UNCHECKED)); }

  UINT IsButtonChecked(int buttonID) const
    { return IsDlgButtonChecked(_window, buttonID); }
  bool IsButtonCheckedBool(int buttonID) const
    { return (IsButtonChecked(buttonID) == BST_CHECKED); }

  bool CheckRadioButton(int firstButtonID, int lastButtonID, int checkButtonID)
    { return BOOLToBool(::CheckRadioButton(_window, firstButtonID, lastButtonID, checkButtonID)); }

  virtual bool OnMessage(UINT message, WPARAM wParam, LPARAM lParam);
  virtual bool OnInit() { return true; }
  virtual bool OnCommand(WPARAM wParam, LPARAM lParam);
  virtual bool OnCommand(int code, int itemID, LPARAM lParam);
  virtual void OnHelp(LPHELPINFO helpInfo) { OnHelp(); };
  virtual void OnHelp() {};
  virtual bool OnButtonClicked(int buttonID, HWND buttonHWND);
  virtual void OnOK() {};
  virtual void OnCancel() {};
  virtual bool OnNotify(UINT controlID, LPNMHDR lParam) { return false; }
  virtual bool OnTimer(WPARAM timerID, LPARAM callback) { return false; }

  LONG_PTR SetMsgResult(LONG_PTR newLongPtr )
    { return SetLongPtr(DWLP_MSGRESULT, newLongPtr); }
  LONG_PTR GetMsgResult() const
    { return GetLongPtr(DWLP_MSGRESULT); }
};

class CModelessDialog: public CDialog
{
public:
  bool Create(LPCTSTR templateName, HWND parentWindow);
  #ifndef _UNICODE
  bool Create(LPCWSTR templateName, HWND parentWindow);
  #endif
  virtual void OnOK() { Destroy(); }
  virtual void OnCancel() { Destroy(); }
};

class CModalDialog: public CDialog
{
public:
  INT_PTR Create(LPCTSTR templateName, HWND parentWindow);
  INT_PTR Create(UINT resID, HWND parentWindow)
    {  return Create(MAKEINTRESOURCEW(resID), parentWindow); }
  #ifndef _UNICODE
  INT_PTR Create(LPCWSTR templateName, HWND parentWindow);
  #endif

  bool End(INT_PTR result)
    { return BOOLToBool(::EndDialog(_window, result)); }
  virtual void OnOK() { End(IDOK); }
  virtual void OnCancel() { End(IDCANCEL); }
};

class CDialogChildControl: public NWindows::CWindow
{
public:
  int m_ID;
  void Init(const NWindows::NControl::CDialog &parentDialog, int id)
  {
    m_ID = id;
    Attach(parentDialog.GetItem(id));
  }
};

}}

#endif