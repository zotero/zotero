// LSBFEncoder.cpp

#include "StdAfx.h"

#include "LSBFEncoder.h"
#include "Common/Defs.h"

namespace NStream {
namespace NLSBF {

void CEncoder::WriteBits(UInt32 value, int numBits)
{
  while(numBits > 0)
  {
    if (numBits < m_BitPos)
    {
      m_CurByte |= (value & ((1 << numBits) - 1)) << (8 - m_BitPos);
      m_BitPos -= numBits;
      return;
    }
    numBits -= m_BitPos;
    m_Stream.WriteByte((Byte)(m_CurByte | (value << (8 - m_BitPos))));
    value >>= m_BitPos;
    m_BitPos = 8;
    m_CurByte = 0;
  }
}

}}
