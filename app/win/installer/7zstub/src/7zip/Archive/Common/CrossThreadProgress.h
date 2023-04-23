// CrossThreadProgress.h

#ifndef __CROSSTHREADPROGRESS_H
#define __CROSSTHREADPROGRESS_H

#include "../../ICoder.h"
#include "../../../Windows/Synchronization.h"
#include "../../../Common/MyCom.h"

class CCrossThreadProgress: 
  public ICompressProgressInfo,
  public CMyUnknownImp
{
public:
  const UInt64 *InSize;
  const UInt64 *OutSize;
  HRESULT Result;
  NWindows::NSynchronization::CAutoResetEvent ProgressEvent;
  NWindows::NSynchronization::CAutoResetEvent WaitEvent;
  void Init()
  {
    ProgressEvent.Reset();
    WaitEvent.Reset();
  }

  MY_UNKNOWN_IMP

  STDMETHOD(SetRatioInfo)(const UInt64 *inSize, const UInt64 *outSize);
};

#endif
