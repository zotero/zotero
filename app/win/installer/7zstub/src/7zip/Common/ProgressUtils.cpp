// ProgressUtils.h

#include "StdAfx.h"

#include "ProgressUtils.h"

void CLocalCompressProgressInfo::Init(ICompressProgressInfo *progress,
    const UInt64 *inStartValue, const UInt64 *outStartValue)
{
  _progress = progress;
  _inStartValueIsAssigned = (inStartValue != NULL);
  if (_inStartValueIsAssigned)
    _inStartValue = *inStartValue;
  _outStartValueIsAssigned = (outStartValue != NULL);
  if (_outStartValueIsAssigned)
    _outStartValue = *outStartValue;
}

STDMETHODIMP CLocalCompressProgressInfo::SetRatioInfo(
    const UInt64 *inSize, const UInt64 *outSize)
{
  UInt64 inSizeNew, outSizeNew;
  const UInt64 *inSizeNewPointer;
  const UInt64 *outSizeNewPointer;
  if (_inStartValueIsAssigned && inSize != NULL)
  {
    inSizeNew = _inStartValue + (*inSize);
    inSizeNewPointer = &inSizeNew;
  }
  else
    inSizeNewPointer = NULL;

  if (_outStartValueIsAssigned && outSize != NULL)
  {
    outSizeNew = _outStartValue + (*outSize);
    outSizeNewPointer = &outSizeNew;
  }
  else
    outSizeNewPointer = NULL;
  return _progress->SetRatioInfo(inSizeNewPointer, outSizeNewPointer);
}


///////////////////////////////////
// 

void CLocalProgress::Init(IProgress *progress, bool inSizeIsMain)
{
  _progress = progress;
  _inSizeIsMain = inSizeIsMain;
}

STDMETHODIMP CLocalProgress::SetRatioInfo(
    const UInt64 *inSize, const UInt64 *outSize)
{
  return _progress->SetCompleted(_inSizeIsMain ? inSize : outSize);
}

