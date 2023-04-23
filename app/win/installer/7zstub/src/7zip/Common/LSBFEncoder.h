// Stream/LSBFEncoder.h

#ifndef __STREAM_LSBFENCODER_H
#define __STREAM_LSBFENCODER_H

#include "../IStream.h"
#include "OutBuffer.h"

namespace NStream {
namespace NLSBF {

class CEncoder
{
  COutBuffer m_Stream;
  int m_BitPos;
  Byte m_CurByte;
public:
  bool Create(UInt32 bufferSize) { return m_Stream.Create(bufferSize); }
  void SetStream(ISequentialOutStream *outStream) { m_Stream.SetStream(outStream); }
  void ReleaseStream() { m_Stream.ReleaseStream(); }
  void Init()
  {
    m_Stream.Init();
    m_BitPos = 8; 
    m_CurByte = 0;
  }
  HRESULT Flush()
  {
    FlushByte();
    return m_Stream.Flush();
  }
  
  void FlushByte()
  {
    if(m_BitPos < 8)
      m_Stream.WriteByte(m_CurByte);
    m_BitPos = 8; 
    m_CurByte = 0;
  }

  void WriteBits(UInt32 value, int numBits);
  UInt32 GetBitPosition() const {  return (8 - m_BitPos); }
  UInt64 GetProcessedSize() const { 
      return m_Stream.GetProcessedSize() + (8 - m_BitPos + 7) /8; }
  void WriteByte(Byte b) { m_Stream.WriteByte(b);}
};


}}

#endif
