// BranchCoder.cpp

#include "StdAfx.h"
#include "BranchCoder.h"

STDMETHODIMP CBranchConverter::Init()
{
  _bufferPos = 0;
  SubInit();
  return S_OK;
}

STDMETHODIMP_(UInt32) CBranchConverter::Filter(Byte *data, UInt32 size)
{
  UInt32 processedSize = SubFilter(data, size);
  _bufferPos += processedSize;
  return processedSize;
}
