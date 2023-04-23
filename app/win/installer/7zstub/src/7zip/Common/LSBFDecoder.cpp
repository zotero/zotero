// Stream/LSBFDecoder.cpp

#include "StdAfx.h"

#include "LSBFDecoder.h"

namespace NStream {
namespace NLSBF {

Byte kInvertTable[256];

class CInverterTableInitializer
{
public:
  CInverterTableInitializer()
  {
    for(int i = 0; i < 256; i++)
    {
      Byte b = Byte(i);
      Byte bInvert = 0;
      for(int j = 0; j < 8; j++)
      {
        bInvert <<= 1;
        if (b & 1)
          bInvert |= 1;
        b >>= 1;
      }
      kInvertTable[i] = bInvert;
    }
  }
} g_InverterTableInitializer;


}}
