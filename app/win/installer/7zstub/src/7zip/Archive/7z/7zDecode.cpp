// 7zDecode.cpp

#include "StdAfx.h"

#include "7zDecode.h"

#include "../../IPassword.h"
#include "../../Common/LockedStream.h"
#include "../../Common/StreamObjects.h"
#include "../../Common/ProgressUtils.h"
#include "../../Common/LimitedStreams.h"
#include "../Common/FilterCoder.h"

#include "7zMethods.h"

#ifdef COMPRESS_LZMA
#include "../../Compress/LZMA/LZMADecoder.h"
static NArchive::N7z::CMethodID k_LZMA = { { 0x3, 0x1, 0x1 }, 3 };
#endif

#ifdef COMPRESS_PPMD
#include "../../Compress/PPMD/PPMDDecoder.h"
static NArchive::N7z::CMethodID k_PPMD = { { 0x3, 0x4, 0x1 }, 3 };
#endif

#ifdef COMPRESS_BCJ_X86
#include "../../Compress/Branch/x86.h"
static NArchive::N7z::CMethodID k_BCJ_X86 = { { 0x3, 0x3, 0x1, 0x3 }, 4 };
#endif

#ifdef COMPRESS_BCJ2
#include "../../Compress/Branch/x86_2.h"
static NArchive::N7z::CMethodID k_BCJ2 = { { 0x3, 0x3, 0x1, 0x1B }, 4 };
#endif

#ifdef COMPRESS_DEFLATE
#ifndef COMPRESS_DEFLATE_DECODER
#define COMPRESS_DEFLATE_DECODER
#endif
#endif

#ifdef COMPRESS_DEFLATE_DECODER
#include "../../Compress/Deflate/DeflateDecoder.h"
static NArchive::N7z::CMethodID k_Deflate = { { 0x4, 0x1, 0x8 }, 3 };
#endif

#ifdef COMPRESS_BZIP2
#ifndef COMPRESS_BZIP2_DECODER
#define COMPRESS_BZIP2_DECODER
#endif
#endif

#ifdef COMPRESS_BZIP2_DECODER
#include "../../Compress/BZip2/BZip2Decoder.h"
static NArchive::N7z::CMethodID k_BZip2 = { { 0x4, 0x2, 0x2 }, 3 };
#endif

#ifdef COMPRESS_COPY
#include "../../Compress/Copy/CopyCoder.h"
static NArchive::N7z::CMethodID k_Copy = { { 0x0 }, 1 };
#endif

#ifdef CRYPTO_7ZAES
#include "../../Crypto/7zAES/7zAES.h"
static NArchive::N7z::CMethodID k_7zAES = { { 0x6, 0xF1, 0x07, 0x01 }, 4 };
#endif

namespace NArchive {
namespace N7z {

static void ConvertFolderItemInfoToBindInfo(const CFolder &folder,
    CBindInfoEx &bindInfo)
{
  bindInfo.Clear();
  int i;
  for (i = 0; i < folder.BindPairs.Size(); i++)
  {
    NCoderMixer2::CBindPair bindPair;
    bindPair.InIndex = (UInt32)folder.BindPairs[i].InIndex;
    bindPair.OutIndex = (UInt32)folder.BindPairs[i].OutIndex;
    bindInfo.BindPairs.Add(bindPair);
  }
  UInt32 outStreamIndex = 0;
  for (i = 0; i < folder.Coders.Size(); i++)
  {
    NCoderMixer2::CCoderStreamsInfo coderStreamsInfo;
    const CCoderInfo &coderInfo = folder.Coders[i];
    coderStreamsInfo.NumInStreams = (UInt32)coderInfo.NumInStreams;
    coderStreamsInfo.NumOutStreams = (UInt32)coderInfo.NumOutStreams;
    bindInfo.Coders.Add(coderStreamsInfo);
    const CAltCoderInfo &altCoderInfo = coderInfo.AltCoders.Front();
    bindInfo.CoderMethodIDs.Add(altCoderInfo.MethodID);
    for (UInt32 j = 0; j < coderStreamsInfo.NumOutStreams; j++, outStreamIndex++)
      if (folder.FindBindPairForOutStream(outStreamIndex) < 0)
        bindInfo.OutStreams.Add(outStreamIndex);
  }
  for (i = 0; i < folder.PackStreams.Size(); i++)
    bindInfo.InStreams.Add((UInt32)folder.PackStreams[i]);
}

static bool AreCodersEqual(const NCoderMixer2::CCoderStreamsInfo &a1, 
    const NCoderMixer2::CCoderStreamsInfo &a2)
{
  return (a1.NumInStreams == a2.NumInStreams) &&
    (a1.NumOutStreams == a2.NumOutStreams);
}

static bool AreBindPairsEqual(const NCoderMixer2::CBindPair &a1, const NCoderMixer2::CBindPair &a2)
{
  return (a1.InIndex == a2.InIndex) &&
    (a1.OutIndex == a2.OutIndex);
}

static bool AreBindInfoExEqual(const CBindInfoEx &a1, const CBindInfoEx &a2)
{
  if (a1.Coders.Size() != a2.Coders.Size())
    return false;
  int i;
  for (i = 0; i < a1.Coders.Size(); i++)
    if (!AreCodersEqual(a1.Coders[i], a2.Coders[i]))
      return false;
  if (a1.BindPairs.Size() != a2.BindPairs.Size())
    return false;
  for (i = 0; i < a1.BindPairs.Size(); i++)
    if (!AreBindPairsEqual(a1.BindPairs[i], a2.BindPairs[i]))
      return false;
  for (i = 0; i < a1.CoderMethodIDs.Size(); i++)
    if (a1.CoderMethodIDs[i] != a2.CoderMethodIDs[i])
      return false;
  if (a1.InStreams.Size() != a2.InStreams.Size())
    return false;
  if (a1.OutStreams.Size() != a2.OutStreams.Size())
    return false;
  return true;
}

CDecoder::CDecoder(bool multiThread)
{
  #ifndef _ST_MODE
  multiThread = true;
  #endif
  _multiThread = multiThread;
  _bindInfoExPrevIsDefinded = false;
  #ifndef EXCLUDE_COM
  LoadMethodMap();
  #endif
}

HRESULT CDecoder::Decode(IInStream *inStream,
    UInt64 startPos,
    const UInt64 *packSizes,
    const CFolder &folderInfo, 
    ISequentialOutStream *outStream,
    ICompressProgressInfo *compressProgress
    #ifndef _NO_CRYPTO
    , ICryptoGetTextPassword *getTextPassword
    #endif
    #ifdef COMPRESS_MT
    , bool mtMode, UInt32 numThreads
    #endif
    )
{
  CObjectVector< CMyComPtr<ISequentialInStream> > inStreams;
  
  CLockedInStream lockedInStream;
  lockedInStream.Init(inStream);
  
  for (int j = 0; j < folderInfo.PackStreams.Size(); j++)
  {
    CLockedSequentialInStreamImp *lockedStreamImpSpec = new 
        CLockedSequentialInStreamImp;
    CMyComPtr<ISequentialInStream> lockedStreamImp = lockedStreamImpSpec;
    lockedStreamImpSpec->Init(&lockedInStream, startPos);
    startPos += packSizes[j];
    
    CLimitedSequentialInStream *streamSpec = new 
        CLimitedSequentialInStream;
    CMyComPtr<ISequentialInStream> inStream = streamSpec;
    streamSpec->Init(lockedStreamImp, packSizes[j]);
    inStreams.Add(inStream);
  }
  
  int numCoders = folderInfo.Coders.Size();
  
  CBindInfoEx bindInfo;
  ConvertFolderItemInfoToBindInfo(folderInfo, bindInfo);
  bool createNewCoders;
  if (!_bindInfoExPrevIsDefinded)
    createNewCoders = true;
  else
    createNewCoders = !AreBindInfoExEqual(bindInfo, _bindInfoExPrev);
  if (createNewCoders)
  {
    int i;
    _decoders.Clear();
    // _decoders2.Clear();
    
    _mixerCoder.Release();

    if (_multiThread)
    {
      _mixerCoderMTSpec = new NCoderMixer2::CCoderMixer2MT;
      _mixerCoder = _mixerCoderMTSpec;
      _mixerCoderCommon = _mixerCoderMTSpec;
    }
    else
    {
      #ifdef _ST_MODE
      _mixerCoderSTSpec = new NCoderMixer2::CCoderMixer2ST;
      _mixerCoder = _mixerCoderSTSpec;
      _mixerCoderCommon = _mixerCoderSTSpec;
      #endif
    }
    _mixerCoderCommon->SetBindInfo(bindInfo);
    
    for (i = 0; i < numCoders; i++)
    {
      const CCoderInfo &coderInfo = folderInfo.Coders[i];
      const CAltCoderInfo &altCoderInfo = coderInfo.AltCoders.Front();
      #ifndef EXCLUDE_COM
      CMethodInfo methodInfo;
      if (!GetMethodInfo(altCoderInfo.MethodID, methodInfo)) 
        return E_NOTIMPL;
      #endif

      if (coderInfo.IsSimpleCoder())
      {
        CMyComPtr<ICompressCoder> decoder;
        CMyComPtr<ICompressFilter> filter;

        #ifdef COMPRESS_LZMA
        if (altCoderInfo.MethodID == k_LZMA)
          decoder = new NCompress::NLZMA::CDecoder;
        #endif

        #ifdef COMPRESS_PPMD
        if (altCoderInfo.MethodID == k_PPMD)
          decoder = new NCompress::NPPMD::CDecoder;
        #endif

        #ifdef COMPRESS_BCJ_X86
        if (altCoderInfo.MethodID == k_BCJ_X86)
          filter = new CBCJ_x86_Decoder;
        #endif

        #ifdef COMPRESS_DEFLATE_DECODER
        if (altCoderInfo.MethodID == k_Deflate)
          decoder = new NCompress::NDeflate::NDecoder::CCOMCoder;
        #endif

        #ifdef COMPRESS_BZIP2_DECODER
        if (altCoderInfo.MethodID == k_BZip2)
          decoder = new NCompress::NBZip2::CDecoder;
        #endif

        #ifdef COMPRESS_COPY
        if (altCoderInfo.MethodID == k_Copy)
          decoder = new NCompress::CCopyCoder;
        #endif

        #ifdef CRYPTO_7ZAES
        if (altCoderInfo.MethodID == k_7zAES)
          filter = new NCrypto::NSevenZ::CDecoder;
        #endif

        if (filter)
        {
          CFilterCoder *coderSpec = new CFilterCoder;
          decoder = coderSpec;
          coderSpec->Filter = filter;
        }
        #ifndef EXCLUDE_COM
        if (decoder == 0)
        {
          RINOK(_libraries.CreateCoderSpec(methodInfo.FilePath, 
              methodInfo.Decoder, &decoder));
        }
        #endif

        if (decoder == 0)
          return E_NOTIMPL;

        _decoders.Add((IUnknown *)decoder);

        if (_multiThread)
          _mixerCoderMTSpec->AddCoder(decoder);
        #ifdef _ST_MODE
        else
          _mixerCoderSTSpec->AddCoder(decoder, false);
        #endif
      }
      else
      {
        CMyComPtr<ICompressCoder2> decoder;

        #ifdef COMPRESS_BCJ2
        if (altCoderInfo.MethodID == k_BCJ2)
          decoder = new CBCJ2_x86_Decoder;
        #endif

        #ifndef EXCLUDE_COM
        if (decoder == 0)
        {
          RINOK(_libraries.CreateCoder2(methodInfo.FilePath, 
              methodInfo.Decoder, &decoder));
        }
        #endif

        if (decoder == 0)
          return E_NOTIMPL;

        _decoders.Add((IUnknown *)decoder);
        if (_multiThread)
          _mixerCoderMTSpec->AddCoder2(decoder);
        #ifdef _ST_MODE
        else
          _mixerCoderSTSpec->AddCoder2(decoder, false);
        #endif
      }
    }
    _bindInfoExPrev = bindInfo;
    _bindInfoExPrevIsDefinded = true;
  }
  int i;
  _mixerCoderCommon->ReInit();
  
  UInt32 packStreamIndex = 0, unPackStreamIndex = 0;
  UInt32 coderIndex = 0;
  // UInt32 coder2Index = 0;
  
  for (i = 0; i < numCoders; i++)
  {
    const CCoderInfo &coderInfo = folderInfo.Coders[i];
    const CAltCoderInfo &altCoderInfo = coderInfo.AltCoders.Front();
    CMyComPtr<IUnknown> &decoder = _decoders[coderIndex];
    
    {
      CMyComPtr<ICompressSetDecoderProperties2> setDecoderProperties;
      HRESULT result = decoder.QueryInterface(IID_ICompressSetDecoderProperties2, &setDecoderProperties);
      if (setDecoderProperties)
      {
        const CByteBuffer &properties = altCoderInfo.Properties;
        size_t size = properties.GetCapacity();
        if (size > 0xFFFFFFFF)
          return E_NOTIMPL;
        if (size > 0)
        {
          RINOK(setDecoderProperties->SetDecoderProperties2((const Byte *)properties, (UInt32)size));
        }
      }
    }

    #ifdef COMPRESS_MT
    if (mtMode)
    {
      CMyComPtr<ICompressSetCoderMt> setCoderMt;
      decoder.QueryInterface(IID_ICompressSetCoderMt, &setCoderMt);
      if (setCoderMt)
      {
        RINOK(setCoderMt->SetNumberOfThreads(numThreads));
      }
    }
    #endif

    #ifndef _NO_CRYPTO
    {
      CMyComPtr<ICryptoSetPassword> cryptoSetPassword;
      HRESULT result = decoder.QueryInterface(IID_ICryptoSetPassword, &cryptoSetPassword);
      if (cryptoSetPassword)
      {
        if (getTextPassword == 0)
          return E_FAIL;
        CMyComBSTR password;
        RINOK(getTextPassword->CryptoGetTextPassword(&password));
        CByteBuffer buffer;
        UString unicodePassword(password);
        const UInt32 sizeInBytes = unicodePassword.Length() * 2;
        buffer.SetCapacity(sizeInBytes);
        for (int i = 0; i < unicodePassword.Length(); i++)
        {
          wchar_t c = unicodePassword[i];
          ((Byte *)buffer)[i * 2] = (Byte)c;
          ((Byte *)buffer)[i * 2 + 1] = (Byte)(c >> 8);
        }
        RINOK(cryptoSetPassword->CryptoSetPassword(
          (const Byte *)buffer, sizeInBytes));
      }
    }
    #endif

    coderIndex++;
    
    UInt32 numInStreams = (UInt32)coderInfo.NumInStreams;
    UInt32 numOutStreams = (UInt32)coderInfo.NumOutStreams;
    CRecordVector<const UInt64 *> packSizesPointers;
    CRecordVector<const UInt64 *> unPackSizesPointers;
    packSizesPointers.Reserve(numInStreams);
    unPackSizesPointers.Reserve(numOutStreams);
    UInt32 j;
    for (j = 0; j < numOutStreams; j++, unPackStreamIndex++)
      unPackSizesPointers.Add(&folderInfo.UnPackSizes[unPackStreamIndex]);
    
    for (j = 0; j < numInStreams; j++, packStreamIndex++)
    {
      int bindPairIndex = folderInfo.FindBindPairForInStream(packStreamIndex);
      if (bindPairIndex >= 0)
        packSizesPointers.Add(
        &folderInfo.UnPackSizes[(UInt32)folderInfo.BindPairs[bindPairIndex].OutIndex]);
      else
      {
        int index = folderInfo.FindPackStreamArrayIndex(packStreamIndex);
        if (index < 0)
          return E_FAIL;
        packSizesPointers.Add(&packSizes[index]);
      }
    }
    
    _mixerCoderCommon->SetCoderInfo(i, 
        &packSizesPointers.Front(), 
        &unPackSizesPointers.Front());
  }
  UInt32 mainCoder, temp;
  bindInfo.FindOutStream(bindInfo.OutStreams[0], mainCoder, temp);

  if (_multiThread)
    _mixerCoderMTSpec->SetProgressCoderIndex(mainCoder);
  /*
  else
    _mixerCoderSTSpec->SetProgressCoderIndex(mainCoder);;
  */
  
  if (numCoders == 0)
    return 0;
  CRecordVector<ISequentialInStream *> inStreamPointers;
  inStreamPointers.Reserve(inStreams.Size());
  for (i = 0; i < inStreams.Size(); i++)
    inStreamPointers.Add(inStreams[i]);
  ISequentialOutStream *outStreamPointer = outStream;
  return _mixerCoder->Code(&inStreamPointers.Front(), NULL, 
    inStreams.Size(), &outStreamPointer, NULL, 1, compressProgress);
}

}}
