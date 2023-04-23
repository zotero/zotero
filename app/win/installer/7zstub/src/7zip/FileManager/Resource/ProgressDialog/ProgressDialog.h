// ProgressDialog.h

#ifndef __PROGRESSDIALOG_H
#define __PROGRESSDIALOG_H

#include "resource.h"

#include "Windows/Control/Dialog.h"
#include "Windows/Control/ProgressBar.h"
#include "Windows/Synchronization.h"

class CProgressSynch
{
  NWindows::NSynchronization::CCriticalSection _criticalSection;
  bool _stopped;
  bool _paused;
  UINT64 _total;
  UINT64 _completed;
public:
  CProgressSynch(): _stopped(false), _paused(false), _total(1), _completed(0) {}

  bool GetStopped()
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    return _stopped;
  }
  void SetStopped(bool value)
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    _stopped = value;
  }
  bool GetPaused()
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    return _paused;
  }
  void SetPaused(bool value)
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    _paused = value;
  }
  void SetProgress(UINT64 total, UINT64 completed)
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    _total = total;
    _completed = completed;
  }
  void SetPos(UINT64 completed)
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    _completed = completed;
  }
  void GetProgress(UINT64 &total, UINT64 &completed)
  {
    NWindows::NSynchronization::CCriticalSectionLock lock(_criticalSection);
    total = _total;
    completed = _completed;
  }
};

class CU64ToI32Converter
{
  UINT64 _numShiftBits;
public:
  void Init(UINT64 _range);
  int Count(UINT64 aValue);
};

// class CProgressDialog: public NWindows::NControl::CModelessDialog

class CProgressDialog: public NWindows::NControl::CModalDialog
{
private:
  UINT_PTR _timer;

  UString _title;
  CU64ToI32Converter _converter;
  UINT64 _peviousPos;
  UINT64 _range;
	NWindows::NControl::CProgressBar m_ProgressBar;

  int _prevPercentValue;

  bool OnTimer(WPARAM timerID, LPARAM callback);
  void SetRange(UINT64 range);
  void SetPos(UINT64 pos);
	virtual bool OnInit();
	virtual void OnCancel();
  NWindows::NSynchronization::CManualResetEvent _dialogCreatedEvent;
  #ifndef _SFX
  void AddToTitle(LPCWSTR string);
  #endif
  bool OnButtonClicked(int buttonID, HWND buttonHWND);
public:
  CProgressSynch ProgressSynch;

  #ifndef _SFX
  HWND MainWindow;
  UString MainTitle;
  UString MainAddTitle;
  ~CProgressDialog();
  #endif

  CProgressDialog(): _timer(0)
    #ifndef _SFX
    ,MainWindow(0) 
    #endif
  {}

  void WaitCreating() { _dialogCreatedEvent.Lock(); }


  INT_PTR Create(const UString &title, HWND wndParent = 0)
  { 
    _title = title;
    return CModalDialog::Create(IDD_DIALOG_PROGRESS, wndParent); 
  }

  static const UINT kCloseMessage;

  virtual bool OnMessage(UINT message, WPARAM wParam, LPARAM lParam);

  void MyClose()
  {
    PostMessage(kCloseMessage);
  };
};

#endif
