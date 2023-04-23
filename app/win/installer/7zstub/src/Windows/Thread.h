// Windows/Thread.h

#ifndef __WINDOWS_THREAD_H
#define __WINDOWS_THREAD_H

#include "Handle.h"
#include "Defs.h"

namespace NWindows {

class CThread: public CHandle
{
  bool IsOpen() const { return _handle != 0; }
public:
  bool Create(LPSECURITY_ATTRIBUTES threadAttributes, 
      SIZE_T stackSize, LPTHREAD_START_ROUTINE startAddress,
      LPVOID parameter, DWORD creationFlags, LPDWORD threadId)
  {
    _handle = ::CreateThread(threadAttributes, stackSize, startAddress,
        parameter, creationFlags, threadId);
    return (_handle != NULL);
  }
  bool Create(LPTHREAD_START_ROUTINE startAddress, LPVOID parameter)
  {
    DWORD threadId;
    return Create(NULL, 0, startAddress, parameter, 0, &threadId);
  }
  
  DWORD Resume()
    { return ::ResumeThread(_handle); }
  DWORD Suspend()
    { return ::SuspendThread(_handle); }
  bool Terminate(DWORD exitCode)
    { return BOOLToBool(::TerminateThread(_handle, exitCode)); }
  
  int GetPriority()
    { return ::GetThreadPriority(_handle); }
  bool SetPriority(int priority)
    { return BOOLToBool(::SetThreadPriority(_handle, priority)); }

  bool Wait() 
  { 
    if (!IsOpen())
      return true;
    return (::WaitForSingleObject(_handle, INFINITE) == WAIT_OBJECT_0); 
  }

};

}

#endif
