// OffsetStream.h

#ifndef __OFFSETSTREAM_H
#define __OFFSETSTREAM_H

#include "Common/MyCom.h"
#include "../IStream.h"

class COffsetOutStream: 
  public IOutStream,
  public CMyUnknownImp
{
  UInt64 _offset;
  CMyComPtr<IOutStream> _stream;
public:
  HRESULT Init(IOutStream *stream, UInt64 offset);
  
  MY_UNKNOWN_IMP

  STDMETHOD(Write)(const void *data, UInt32 size, UInt32 *processedSize);
  STDMETHOD(Seek)(Int64 offset, UInt32 seekOrigin, UInt64 *newPosition);
  STDMETHOD(SetSize)(Int64 newSize);
};

#endif
