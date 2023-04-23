// FilterCoder.h

#ifndef __FILTERCODER_H
#define __FILTERCODER_H

#include "../../../Common/MyCom.h"
#include "../../ICoder.h"
#include "../../IPassword.h"

#define MY_QUERYINTERFACE_ENTRY_AG(i, sub0, sub) if (iid == IID_ ## i) \
{ if (!sub) RINOK(sub0->QueryInterface(IID_ ## i, (void **)&sub)) \
*outObject = (void *)(i *)this; AddRef(); return S_OK; } 

class CFilterCoder:
  public ICompressCoder,
  // #ifdef _ST_MODE
  public ICompressSetInStream,
  public ISequentialInStream,
  public ICompressSetOutStream,
  public ISequentialOutStream,
  public IOutStreamFlush,
  // #endif

  #ifndef _NO_CRYPTO
  public ICryptoSetPassword,
  #endif
  #ifndef EXTRACT_ONLY
  public ICompressWriteCoderProperties,
  #endif
  public ICompressSetDecoderProperties2,
  public CMyUnknownImp
{
protected:
  Byte *_buffer;
  // #ifdef _ST_MODE
  CMyComPtr<ISequentialInStream> _inStream;
  CMyComPtr<ISequentialOutStream> _outStream;
  UInt32 _bufferPos;
  UInt32 _convertedPosBegin;
  UInt32 _convertedPosEnd;
  // #endif
  bool _outSizeIsDefined;
  UInt64 _outSize;
  UInt64 _nowPos64;

  HRESULT Init() 
  { 
    _nowPos64 = 0;
    _outSizeIsDefined = false;
    return Filter->Init(); 
  }

  CMyComPtr<ICryptoSetPassword> _setPassword;
  #ifndef EXTRACT_ONLY
  CMyComPtr<ICompressWriteCoderProperties> _writeCoderProperties;
  #endif
  CMyComPtr<ICompressSetDecoderProperties2> _setDecoderProperties;
public:
  CMyComPtr<ICompressFilter> Filter;

  CFilterCoder();
  ~CFilterCoder();
  HRESULT WriteWithLimit(ISequentialOutStream *outStream, UInt32 size);
  bool NeedMore() const  
    { return (!_outSizeIsDefined || (_nowPos64 < _outSize)); }

public:
  MY_QUERYINTERFACE_BEGIN
    MY_QUERYINTERFACE_ENTRY(ICompressCoder)
    // #ifdef _ST_MODE
    MY_QUERYINTERFACE_ENTRY(ICompressSetInStream)
    MY_QUERYINTERFACE_ENTRY(ISequentialInStream)

    MY_QUERYINTERFACE_ENTRY(ICompressSetOutStream)
    MY_QUERYINTERFACE_ENTRY(ISequentialOutStream)
    MY_QUERYINTERFACE_ENTRY(IOutStreamFlush)
    // #endif

    #ifndef _NO_CRYPTO
    MY_QUERYINTERFACE_ENTRY_AG(ICryptoSetPassword, Filter, _setPassword)
    #endif

    #ifndef EXTRACT_ONLY
    MY_QUERYINTERFACE_ENTRY_AG(ICompressWriteCoderProperties, Filter, _writeCoderProperties)
    #endif

    MY_QUERYINTERFACE_ENTRY_AG(ICompressSetDecoderProperties2, Filter, _setDecoderProperties)
  MY_QUERYINTERFACE_END
  MY_ADDREF_RELEASE
  STDMETHOD(Code)(ISequentialInStream *inStream,
      ISequentialOutStream *outStream, const UInt64 *inSize, const UInt64 *outSize,
      ICompressProgressInfo *progress);
  // #ifdef _ST_MODE
  STDMETHOD(ReleaseInStream)();
  STDMETHOD(SetInStream)(ISequentialInStream *inStream);
  STDMETHOD(Read)(void *data, UInt32 size, UInt32 *processedSize); \
  STDMETHOD(SetOutStream)(ISequentialOutStream *outStream);
  STDMETHOD(ReleaseOutStream)();
  STDMETHOD(Write)(const void *data, UInt32 size, UInt32 *processedSize);
  STDMETHOD(Flush)();
  // #endif

  #ifndef _NO_CRYPTO
  STDMETHOD(CryptoSetPassword)(const Byte *data, UInt32 size);
  #endif
  #ifndef EXTRACT_ONLY
  STDMETHOD(WriteCoderProperties)(ISequentialOutStream *outStream);
  #endif
  STDMETHOD(SetDecoderProperties2)(const Byte *data, UInt32 size);
};

// #ifdef _ST_MODE
class CInStreamReleaser
{
public:
  CFilterCoder *FilterCoder;
  CInStreamReleaser(): FilterCoder(0) {}
  ~CInStreamReleaser() { if (FilterCoder) FilterCoder->ReleaseInStream(); }
};

class COutStreamReleaser
{
public:
  CFilterCoder *FilterCoder;
  COutStreamReleaser(): FilterCoder(0) {}
  ~COutStreamReleaser() { if (FilterCoder) FilterCoder->ReleaseOutStream(); }
};
// #endif

#endif
