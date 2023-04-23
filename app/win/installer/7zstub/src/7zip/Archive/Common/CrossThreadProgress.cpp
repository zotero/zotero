// CrossThreadProgress.cpp

#include "StdAfx.h"

#include "CrossThreadProgress.h"

STDMETHODIMP CCrossThreadProgress::SetRatioInfo(const UInt64 *inSize, const UInt64 *outSize)
{
  InSize = inSize;
  OutSize = outSize;
  ProgressEvent.Set();
  WaitEvent.Lock();
  return Result;
}

