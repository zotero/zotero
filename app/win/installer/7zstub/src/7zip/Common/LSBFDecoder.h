// LSBFDecoder.h

#ifndef __STREAM_LSBFDECODER_H
#define __STREAM_LSBFDECODER_H

#include "../IStream.h"

namespace NStream {
namespace NLSBF {

const int kNumBigValueBits = 8 * 4;

const int kNumValueBytes = 3;
const int kNumValueBits = 8  * kNumValueBytes;

const UInt32 kMask = (1 << kNumValueBits) - 1;

extern Byte kInvertTable[256];
// the Least Significant Bit of byte is First

template<class TInByte>
class CBaseDecoder
{
protected:
  int m_BitPos;
  UInt32 m_Value;
  TInByte m_Stream;
public:
  UInt32 NumExtraBytes;
  bool Create(UInt32 bufferSize) { return m_Stream.Create(bufferSize); }
  void SetStream(ISequentialInStream *inStream) { m_Stream.SetStream(inStream); }
  void ReleaseStream() { m_Stream.ReleaseStream(); }
  void Init()
  {
    m_Stream.Init();
    m_BitPos = kNumBigValueBits; 
    m_Value = 0;
    NumExtraBytes = 0;
  }
  UInt64 GetProcessedSize() const 
    { return m_Stream.GetProcessedSize() - (kNumBigValueBits - m_BitPos) / 8; }
  UInt64 GetProcessedBitsSize() const 
    { return (m_Stream.GetProcessedSize() << 3) - (kNumBigValueBits - m_BitPos); }
  int GetBitPosition() const { return (m_BitPos & 7); }

  void Normalize()
  {
    for (;m_BitPos >= 8; m_BitPos -= 8)
    {
      Byte b;
      if (!m_Stream.ReadByte(b))
      {
        b = 0xFF; // check it
        NumExtraBytes++;
      }
      m_Value = (b << (kNumBigValueBits - m_BitPos)) | m_Value;
    }
  }
  
  UInt32 ReadBits(int numBits)
  {
    Normalize();
    UInt32 res = m_Value & ((1 << numBits) - 1);
    m_BitPos += numBits;
    m_Value >>= numBits;
    return res;
  }

  bool ExtraBitsWereRead() const
  {
    if (NumExtraBytes == 0)
      return false;
    return ((UInt32)(kNumBigValueBits - m_BitPos) < (NumExtraBytes << 3));
  }
};

template<class TInByte>
class CDecoder: public CBaseDecoder<TInByte>
{
  UInt32 m_NormalValue;

public:
  void Init()
  {
    CBaseDecoder<TInByte>::Init();
    m_NormalValue = 0;
  }

  void Normalize()
  {
    for (;this->m_BitPos >= 8; this->m_BitPos -= 8)
    {
      Byte b;
      if (!this->m_Stream.ReadByte(b))
      {
        b = 0xFF; // check it
        this->NumExtraBytes++;
      }
      m_NormalValue = (b << (kNumBigValueBits - this->m_BitPos)) | m_NormalValue;
      this->m_Value = (this->m_Value << 8) | kInvertTable[b];
    }
  }
  
  UInt32 GetValue(int numBits)
  {
    Normalize();
    return ((this->m_Value >> (8 - this->m_BitPos)) & kMask) >> (kNumValueBits - numBits);
  }

  void MovePos(int numBits)
  {
    this->m_BitPos += numBits;
    m_NormalValue >>= numBits;
  }
  
  UInt32 ReadBits(int numBits)
  {
    Normalize();
    UInt32 res = m_NormalValue & ( (1 << numBits) - 1);
    MovePos(numBits);
    return res;
  }
};

}}

#endif
