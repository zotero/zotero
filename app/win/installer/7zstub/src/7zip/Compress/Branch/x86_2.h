// x86_2.h

#ifndef __BRANCH_X86_2_H
#define __BRANCH_X86_2_H

#include "../../../Common/MyCom.h"
#include "../RangeCoder/RangeCoderBit.h"
#include "../../ICoder.h"

// {23170F69-40C1-278B-0303-010100000100}
#define MyClass2_a(Name, id, subId, encodingId)  \
DEFINE_GUID(CLSID_CCompressConvert ## Name,  \
0x23170F69, 0x40C1, 0x278B, 0x03, 0x03, id, subId, 0x00, 0x00, encodingId, 0x00);

#define MyClass_a(Name, id, subId)  \
MyClass2_a(Name ## _Encoder, id, subId, 0x01) \
MyClass2_a(Name ## _Decoder, id, subId, 0x00) 

MyClass_a(BCJ2_x86, 0x01, 0x1B)

const int kNumMoveBits = 5;

#ifndef EXTRACT_ONLY

class CBCJ2_x86_Encoder:
  public ICompressCoder2,
  public CMyUnknownImp
{
  Byte *_buffer;
public:
  CBCJ2_x86_Encoder(): _buffer(0) {};
  ~CBCJ2_x86_Encoder();
  bool Create();

  COutBuffer _mainStream;
  COutBuffer _callStream;
  COutBuffer _jumpStream;
  NCompress::NRangeCoder::CEncoder _rangeEncoder;
  NCompress::NRangeCoder::CBitEncoder<kNumMoveBits> _statusE8Encoder[256];
  NCompress::NRangeCoder::CBitEncoder<kNumMoveBits> _statusE9Encoder;
  NCompress::NRangeCoder::CBitEncoder<kNumMoveBits> _statusJccEncoder;

  HRESULT Flush();
  void ReleaseStreams()
  {
    _mainStream.ReleaseStream();
    _callStream.ReleaseStream();
    _jumpStream.ReleaseStream();
    _rangeEncoder.ReleaseStream();
  }

  class CCoderReleaser
  {
    CBCJ2_x86_Encoder *_coder;
  public:
    CCoderReleaser(CBCJ2_x86_Encoder *coder): _coder(coder) {}
    ~CCoderReleaser() {  _coder->ReleaseStreams(); }
  };

public: 

  MY_UNKNOWN_IMP

  HRESULT CodeReal(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress);
  STDMETHOD(Code)(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress);
}; 

#endif

class CBCJ2_x86_Decoder:
  public ICompressCoder2,
  public CMyUnknownImp
{ 
public:
  CInBuffer _mainInStream;
  CInBuffer _callStream;
  CInBuffer _jumpStream;
  NCompress::NRangeCoder::CDecoder _rangeDecoder;
  NCompress::NRangeCoder::CBitDecoder<kNumMoveBits> _statusE8Decoder[256];
  NCompress::NRangeCoder::CBitDecoder<kNumMoveBits> _statusE9Decoder;
  NCompress::NRangeCoder::CBitDecoder<kNumMoveBits> _statusJccDecoder;

  COutBuffer _outStream;

  void ReleaseStreams()
  {
    _mainInStream.ReleaseStream();
    _callStream.ReleaseStream();
    _jumpStream.ReleaseStream();
    _rangeDecoder.ReleaseStream();
    _outStream.ReleaseStream();
  }

  HRESULT Flush() { return _outStream.Flush(); }
  class CCoderReleaser
  {
    CBCJ2_x86_Decoder *_coder;
  public:
    CCoderReleaser(CBCJ2_x86_Decoder *coder): _coder(coder) {}
    ~CCoderReleaser()  { _coder->ReleaseStreams(); }
  };

public: 
  MY_UNKNOWN_IMP
  HRESULT CodeReal(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress);
  STDMETHOD(Code)(ISequentialInStream **inStreams,
      const UInt64 **inSizes,
      UInt32 numInStreams,
      ISequentialOutStream **outStreams,
      const UInt64 **outSizes,
      UInt32 numOutStreams,
      ICompressProgressInfo *progress);
}; 

#endif
