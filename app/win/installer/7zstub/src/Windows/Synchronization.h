// Windows/Synchronization.h

#ifndef __WINDOWS_SYNCHRONIZATION_H
#define __WINDOWS_SYNCHRONIZATION_H

#include "Defs.h"
#include "Handle.h"

namespace NWindows {
namespace NSynchronization {

class CObject: public CHandle
{
public:
  bool Lock(DWORD timeoutInterval = INFINITE)
    { return (::WaitForSingleObject(_handle, timeoutInterval) == WAIT_OBJECT_0); }
};

class CBaseEvent: public CObject
{
public:
  bool Create(bool manualReset, bool initiallyOwn, LPCTSTR name = NULL,
      LPSECURITY_ATTRIBUTES securityAttributes = NULL)
  {
    _handle = ::CreateEvent(securityAttributes, BoolToBOOL(manualReset),
        BoolToBOOL(initiallyOwn), name);
    return (_handle != 0);
  }

  bool Open(DWORD desiredAccess, bool inheritHandle, LPCTSTR name)
  {
    _handle = ::OpenEvent(desiredAccess, BoolToBOOL(inheritHandle), name);
    return (_handle != 0);
  }

  bool Set() { return BOOLToBool(::SetEvent(_handle)); }
  bool Pulse() { return BOOLToBool(::PulseEvent(_handle)); }
  bool Reset() { return BOOLToBool(::ResetEvent(_handle)); }
};

class CEvent: public CBaseEvent
{
public:
  CEvent() {};
  CEvent(bool manualReset, bool initiallyOwn, 
      LPCTSTR name = NULL, LPSECURITY_ATTRIBUTES securityAttributes = NULL);
};

class CManualResetEvent: public CEvent
{
public:
  CManualResetEvent(bool initiallyOwn = false, LPCTSTR name = NULL, 
      LPSECURITY_ATTRIBUTES securityAttributes = NULL):
    CEvent(true, initiallyOwn, name, securityAttributes) {};
};

class CAutoResetEvent: public CEvent
{
public:
  CAutoResetEvent(bool initiallyOwn = false, LPCTSTR name = NULL, 
      LPSECURITY_ATTRIBUTES securityAttributes = NULL):
    CEvent(false, initiallyOwn, name, securityAttributes) {};
};

class CMutex: public CObject
{
public:
  bool Create(bool initiallyOwn, LPCTSTR name = NULL,
      LPSECURITY_ATTRIBUTES securityAttributes = NULL)
  {
    _handle = ::CreateMutex(securityAttributes, BoolToBOOL(initiallyOwn), name);
    return (_handle != 0);
  }
  bool Open(DWORD desiredAccess, bool inheritHandle, LPCTSTR name)
  {
    _handle = ::OpenMutex(desiredAccess, BoolToBOOL(inheritHandle), name);
    return (_handle != 0);
  }
  bool Release() { return BOOLToBool(::ReleaseMutex(_handle)); }
};

class CMutexLock
{
  CMutex &_object;
public:
  CMutexLock(CMutex &object): _object(object) { _object.Lock(); } 
  ~CMutexLock() { _object.Release(); }
};

class CCriticalSection
{
  CRITICAL_SECTION _object;
  // void Initialize() { ::InitializeCriticalSection(&_object); }
  // void Delete() { ::DeleteCriticalSection(&_object); }
public:
  CCriticalSection() { ::InitializeCriticalSection(&_object); }
  ~CCriticalSection() { ::DeleteCriticalSection(&_object); }
  void Enter() { ::EnterCriticalSection(&_object); }
  void Leave() { ::LeaveCriticalSection(&_object); }
};

class CCriticalSectionLock
{
  CCriticalSection &_object;
  void Unlock()  { _object.Leave(); }
public:
  CCriticalSectionLock(CCriticalSection &object): _object(object) 
    {_object.Enter(); } 
  ~CCriticalSectionLock() { Unlock(); }
};

}}

#endif
