// x86.cpp

#include "StdAfx.h"
#include "x86.h"

#include "Windows/Defs.h"

#include "BranchX86.c"

UInt32 CBCJ_x86_Encoder::SubFilter(Byte *data, UInt32 size)
{
  return ::x86_Convert(data, size, _bufferPos, &_prevMask, &_prevPos, 1);
}

UInt32 CBCJ_x86_Decoder::SubFilter(Byte *data, UInt32 size)
{
  return ::x86_Convert(data, size, _bufferPos, &_prevMask, &_prevPos, 0);
}
