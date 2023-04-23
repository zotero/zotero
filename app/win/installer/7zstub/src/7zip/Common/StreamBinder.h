// StreamBinder.h

#ifndef __STREAMBINDER_H
#define __STREAMBINDER_H

#include "../IStream.h"
#include "../../Windows/Synchronization.h"

class CStreamBinder
{
  NWindows::NSynchronization::CManualResetEvent *_allBytesAreWritenEvent;
  NWindows::NSynchronization::CManualResetEvent *_thereAreBytesToReadEvent;
  NWindows::NSynchronization::CManualResetEvent *_readStreamIsClosedEvent;
  UInt32 _bufferSize;
  const void *_buffer;
public:
  // bool ReadingWasClosed;
  UInt64 ProcessedSize;
  CStreamBinder():
    _allBytesAreWritenEvent(NULL), 
    _thereAreBytesToReadEvent(NULL),
    _readStreamIsClosedEvent(NULL)
    {}
  ~CStreamBinder();
  void CreateEvents();

  void CreateStreams(ISequentialInStream **inStream, 
      ISequentialOutStream **outStream);
  HRESULT Read(void *data, UInt32 size, UInt32 *processedSize);
  void CloseRead();

  HRESULT Write(const void *data, UInt32 size, UInt32 *processedSize);
  void CloseWrite();
  void ReInit();
};

#endif
