// 7z/Handler.h

#ifndef __7Z_HANDLER_H
#define __7Z_HANDLER_H

#include "../IArchive.h"
#include "7zIn.h"

#include "7zCompressionMode.h"

#ifndef _SFX
#include "7zMethods.h"
#endif

#ifdef COMPRESS_MT
#include "../../../Windows/System.h"
#endif

namespace NArchive {
namespace N7z {

#ifdef _7Z_VOL
struct CRef
{
  int VolumeIndex;
  int ItemIndex;
};

/*
struct CRef2
{
  CRecordVector<CRef> Refs;
  UInt64 UnPackSize;
  UInt64 PackSize;
  UInt64 StartPos;
  CRef2(): UnPackSize(0), PackSize(0), StartPos(0) {}
};
*/

struct CVolume
{
  int StartRef2Index;
  CMyComPtr<IInStream> Stream;
  CArchiveDatabaseEx Database;
};
#endif

#ifndef EXTRACT_ONLY

struct COneMethodInfo
{
  CObjectVector<CProperty> CoderProperties;
  UString MethodName;
};
#endif

// {23170F69-40C1-278A-1000-000110070000}
DEFINE_GUID(CLSID_CFormat7z, 
  0x23170F69, 0x40C1, 0x278A, 0x10, 0x00, 0x00, 0x01, 0x10, 0x07, 0x00, 0x00);

#ifndef __7Z_SET_PROPERTIES

#ifdef EXTRACT_ONLY
#ifdef COMPRESS_MT
#define __7Z_SET_PROPERTIES
#endif
#else 
#define __7Z_SET_PROPERTIES
#endif

#endif


class CHandler: 
  public IInArchive,
  #ifdef _7Z_VOL
  public IInArchiveGetStream,
  #endif
  #ifdef __7Z_SET_PROPERTIES
  public ISetProperties, 
  #endif
  #ifndef EXTRACT_ONLY
  public IOutArchive, 
  #endif
  public CMyUnknownImp
{
public:
  MY_QUERYINTERFACE_BEGIN
  #ifdef _7Z_VOL
  MY_QUERYINTERFACE_ENTRY(IInArchiveGetStream)
  #endif
  #ifdef __7Z_SET_PROPERTIES
  MY_QUERYINTERFACE_ENTRY(ISetProperties)
  #endif
  #ifndef EXTRACT_ONLY
  MY_QUERYINTERFACE_ENTRY(IOutArchive)
  #endif
  MY_QUERYINTERFACE_END
  MY_ADDREF_RELEASE

  STDMETHOD(Open)(IInStream *stream, 
      const UInt64 *maxCheckStartPosition,
      IArchiveOpenCallback *openArchiveCallback);  
  STDMETHOD(Close)();  
  
  STDMETHOD(GetNumberOfItems)(UInt32 *numItems);  
  STDMETHOD(GetProperty)(UInt32 index, PROPID propID,  PROPVARIANT *value);
  STDMETHOD(Extract)(const UInt32* indices, UInt32 numItems, 
      Int32 testMode, IArchiveExtractCallback *extractCallback);

  STDMETHOD(GetArchiveProperty)(PROPID propID, PROPVARIANT *value);

  STDMETHOD(GetNumberOfProperties)(UInt32 *numProperties);  
  STDMETHOD(GetPropertyInfo)(UInt32 index,     
      BSTR *name, PROPID *propID, VARTYPE *varType);

  STDMETHOD(GetNumberOfArchiveProperties)(UInt32 *numProperties);  
  STDMETHOD(GetArchivePropertyInfo)(UInt32 index,     
      BSTR *name, PROPID *propID, VARTYPE *varType);

  #ifdef _7Z_VOL
  STDMETHOD(GetStream)(UInt32 index, ISequentialInStream **stream);  
  #endif

  #ifdef __7Z_SET_PROPERTIES
  STDMETHOD(SetProperties)(const wchar_t **names, const PROPVARIANT *values, Int32 numProperties);
  #endif

  #ifndef EXTRACT_ONLY
  // IOutArchiveHandler
  STDMETHOD(UpdateItems)(ISequentialOutStream *outStream, UInt32 numItems,
      IArchiveUpdateCallback *updateCallback);

  STDMETHOD(GetFileTimeType)(UInt32 *type);  

  // ISetProperties
  
  HRESULT SetSolidSettings(const UString &s);
  HRESULT SetSolidSettings(const PROPVARIANT &value);
  #endif

  CHandler();

private:
  #ifdef _7Z_VOL
  CObjectVector<CVolume> _volumes;
  CObjectVector<CRef> _refs;
  #else
  CMyComPtr<IInStream> _inStream;
  NArchive::N7z::CArchiveDatabaseEx _database;
  #endif

  #ifdef COMPRESS_MT
  UInt32 _numThreads;
  #endif

  #ifndef EXTRACT_ONLY
  CObjectVector<COneMethodInfo> _methods;
  CRecordVector<CBind> _binds;
  bool _removeSfxBlock;
  UInt64 _numSolidFiles; 
  UInt64 _numSolidBytes;
  bool _numSolidBytesDefined;
  bool _solidExtension;

  bool _compressHeaders;
  bool _compressHeadersFull;
  bool _encryptHeaders;

  bool _autoFilter;
  UInt32 _level;

  bool _volumeMode;


  HRESULT SetParam(COneMethodInfo &oneMethodInfo, const UString &name, const UString &value);
  HRESULT SetParams(COneMethodInfo &oneMethodInfo, const UString &srcString);

  HRESULT SetPassword(CCompressionMethodMode &methodMode,
      IArchiveUpdateCallback *updateCallback);

  HRESULT SetCompressionMethod(CCompressionMethodMode &method,
      CObjectVector<COneMethodInfo> &methodsInfo
      #ifdef COMPRESS_MT
      , UInt32 numThreads
      #endif
      );

  HRESULT SetCompressionMethod(
      CCompressionMethodMode &method,
      CCompressionMethodMode &headerMethod);

  #endif
  
  #ifndef _SFX

  CRecordVector<UInt64> _fileInfoPopIDs;
  void FillPopIDs();

  #endif

  #ifndef EXTRACT_ONLY

  void InitSolidFiles() { _numSolidFiles = UInt64(Int64(-1)); }
  void InitSolidSize()  { _numSolidBytes = UInt64(Int64(-1)); }
  void InitSolid()
  {
    InitSolidFiles();
    InitSolidSize();
    _solidExtension = false;
    _numSolidBytesDefined = false;
  }

  void Init()
  {
    _removeSfxBlock = false;
    _compressHeaders = true;
    _compressHeadersFull = true;
    _encryptHeaders = false;
    #ifdef COMPRESS_MT
    _numThreads = NWindows::NSystem::GetNumberOfProcessors();
    #endif

    _level = 5;
    _autoFilter = true;
    _volumeMode = false;
    InitSolid();
  }
  #endif
};

}}

#endif
