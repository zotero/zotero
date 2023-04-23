// 7zCompressionMode.h

#ifndef __7Z_COMPRESSION_MODE_H
#define __7Z_COMPRESSION_MODE_H

#include "../../../Windows/PropVariant.h"

#include "7zMethodID.h"

namespace NArchive {
namespace N7z {

struct CProperty
{
  PROPID PropID;
  NWindows::NCOM::CPropVariant Value;
};

struct CMethodFull
{
  CMethodID MethodID;
  UInt32 NumInStreams;
  UInt32 NumOutStreams;
  bool IsSimpleCoder() const 
    { return (NumInStreams == 1) && (NumOutStreams == 1); }

  #ifdef EXCLUDE_COM
  #else
  CLSID EncoderClassID;
  CSysString FilePath;
  #endif

  CObjectVector<CProperty> CoderProperties;
};

struct CBind
{
  UInt32 InCoder;
  UInt32 InStream;
  UInt32 OutCoder;
  UInt32 OutStream;
};

struct CCompressionMethodMode
{
  CObjectVector<CMethodFull> Methods;
  CRecordVector<CBind> Binds;
  #ifdef COMPRESS_MT
  UInt32 NumThreads;
  #endif
  bool PasswordIsDefined;
  UString Password;

  bool IsEmpty() const { return (Methods.IsEmpty() && !PasswordIsDefined); }
  CCompressionMethodMode(): PasswordIsDefined(false)
      #ifdef COMPRESS_MT
      , NumThreads(1) 
      #endif
  {}
};

}}

#endif
