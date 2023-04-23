// StreamBinder.cpp

#include "StdAfx.h"

#include "StreamBinder.h"
#include "../../Common/Defs.h"
#include "../../Common/MyCom.h"

using namespace NWindows;
using namespace NSynchronization;

class CSequentialInStreamForBinder: 
  public ISequentialInStream,
  public CMyUnknownImp
{
public:
  MY_UNKNOWN_IMP

  STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize);
private:
  CStreamBinder *m_StreamBinder;
public:
  ~CSequentialInStreamForBinder() { m_StreamBinder->CloseRead(); }
  void SetBinder(CStreamBinder *streamBinder) { m_StreamBinder = streamBinder; }
};

STDMETHODIMP CSequentialInStreamForBinder::Read(void *data, UInt32 size, UInt32 *processedSize)
  { return m_StreamBinder->Read(data, size, processedSize); }

class CSequentialOutStreamForBinder: 
  public ISequentialOutStream,
  public CMyUnknownImp
{
public:
  MY_UNKNOWN_IMP

  STDMETHOD(Write)(const void *data, UInt32 size, UInt32 *processedSize);

private:
  CStreamBinder *m_StreamBinder;
public:
  ~CSequentialOutStreamForBinder() {  m_StreamBinder->CloseWrite(); }
  void SetBinder(CStreamBinder *streamBinder) { m_StreamBinder = streamBinder; }
};

STDMETHODIMP CSequentialOutStreamForBinder::Write(const void *data, UInt32 size, UInt32 *processedSize)
  { return m_StreamBinder->Write(data, size, processedSize); }


//////////////////////////
// CStreamBinder
// (_thereAreBytesToReadEvent && _bufferSize == 0) means that stream is finished.

void CStreamBinder::CreateEvents()
{
  _allBytesAreWritenEvent = new CManualResetEvent(true);
  _thereAreBytesToReadEvent = new CManualResetEvent(false);
  _readStreamIsClosedEvent = new CManualResetEvent(false);
}

void CStreamBinder::ReInit()
{
  _thereAreBytesToReadEvent->Reset();
  _readStreamIsClosedEvent->Reset();
  ProcessedSize = 0;
}

CStreamBinder::~CStreamBinder()
{
  if (_allBytesAreWritenEvent != NULL)
    delete _allBytesAreWritenEvent;
  if (_thereAreBytesToReadEvent != NULL)
    delete _thereAreBytesToReadEvent;
  if (_readStreamIsClosedEvent != NULL)
    delete _readStreamIsClosedEvent;
}



  
void CStreamBinder::CreateStreams(ISequentialInStream **inStream, 
      ISequentialOutStream **outStream)
{
  CSequentialInStreamForBinder *inStreamSpec = new 
      CSequentialInStreamForBinder;
  CMyComPtr<ISequentialInStream> inStreamLoc(inStreamSpec);
  inStreamSpec->SetBinder(this);
  *inStream = inStreamLoc.Detach();

  CSequentialOutStreamForBinder *outStreamSpec = new 
      CSequentialOutStreamForBinder;
  CMyComPtr<ISequentialOutStream> outStreamLoc(outStreamSpec);
  outStreamSpec->SetBinder(this);
  *outStream = outStreamLoc.Detach();

  _buffer = NULL;
  _bufferSize= 0;
  ProcessedSize = 0;
}

HRESULT CStreamBinder::Read(void *data, UInt32 size, UInt32 *processedSize)
{
  UInt32 sizeToRead = size;
  if (size > 0)
  {
    if(!_thereAreBytesToReadEvent->Lock())
      return E_FAIL;
    sizeToRead = MyMin(_bufferSize, size);
    if (_bufferSize > 0)
    {
      MoveMemory(data, _buffer, sizeToRead);
      _buffer = ((const Byte *)_buffer) + sizeToRead;
      _bufferSize -= sizeToRead;
      if (_bufferSize == 0)
      {
        _thereAreBytesToReadEvent->Reset();
        _allBytesAreWritenEvent->Set();
      }
    }
  }
  if (processedSize != NULL)
    *processedSize = sizeToRead;
  ProcessedSize += sizeToRead;
  return S_OK;
}

void CStreamBinder::CloseRead()
{
  _readStreamIsClosedEvent->Set();
}

HRESULT CStreamBinder::Write(const void *data, UInt32 size, UInt32 *processedSize)
{
  if (size > 0)
  {
    _buffer = data;
    _bufferSize = size;
    _allBytesAreWritenEvent->Reset();
    _thereAreBytesToReadEvent->Set();

    HANDLE events[2]; 
    events[0] = *_allBytesAreWritenEvent;
    events[1] = *_readStreamIsClosedEvent; 
    DWORD waitResult = ::WaitForMultipleObjects(2, events, FALSE, INFINITE);
    if (waitResult != WAIT_OBJECT_0 + 0)
    {
      // ReadingWasClosed = true;
      return E_FAIL;
    }
    // if(!_allBytesAreWritenEvent.Lock())
    //   return E_FAIL;
  }
  if (processedSize != NULL)
    *processedSize = size;
  return S_OK;
}

void CStreamBinder::CloseWrite()
{
  // _bufferSize must be = 0
  _thereAreBytesToReadEvent->Set();
}
