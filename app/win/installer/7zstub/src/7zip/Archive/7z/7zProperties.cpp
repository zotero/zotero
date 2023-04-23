// 7zProperties.cpp

#include "StdAfx.h"

#include "7zProperties.h"
#include "7zHeader.h"
#include "7zHandler.h"

// #define _MULTI_PACK

namespace NArchive {
namespace N7z {

struct CPropMap
{
  UInt64 FilePropID;
  STATPROPSTG StatPROPSTG;
};

CPropMap kPropMap[] = 
{
  { NID::kName, NULL, kpidPath, VT_BSTR},
  { NID::kSize, NULL, kpidSize, VT_UI8},
  { NID::kPackInfo, NULL, kpidPackedSize, VT_UI8},
  
  #ifdef _MULTI_PACK
  { 100, L"Pack0", kpidPackedSize0, VT_UI8},
  { 101, L"Pack1", kpidPackedSize1, VT_UI8},
  { 102, L"Pack2", kpidPackedSize2, VT_UI8},
  { 103, L"Pack3", kpidPackedSize3, VT_UI8},
  { 104, L"Pack4", kpidPackedSize4, VT_UI8},
  #endif

  { NID::kCreationTime, NULL, kpidCreationTime, VT_FILETIME},
  { NID::kLastWriteTime, NULL, kpidLastWriteTime, VT_FILETIME},
  { NID::kLastAccessTime, NULL, kpidLastAccessTime, VT_FILETIME},
  { NID::kWinAttributes, NULL, kpidAttributes, VT_UI4},
  { NID::kStartPos, NULL, kpidPosition, VT_UI4},


  { NID::kCRC, NULL, kpidCRC, VT_UI4},
  
  { NID::kAnti, L"Anti", kpidIsAnti, VT_BOOL},
  // { 97, NULL, kpidSolid, VT_BOOL},
  #ifndef _SFX
  { 98, NULL, kpidMethod, VT_BSTR},
  { 99, L"Block", kpidBlock, VT_UI4}
  #endif
  // { L"ID", kpidID, VT_BSTR},
  // { L"UnPack Version", kpidUnPackVersion, VT_UI1},
  // { L"Host OS", kpidHostOS, VT_BSTR}
};

static const int kPropMapSize = sizeof(kPropMap) / sizeof(kPropMap[0]);

static int FindPropInMap(UInt64 filePropID)
{
  for (int i = 0; i < kPropMapSize; i++)
    if (kPropMap[i].FilePropID == filePropID)
      return i;
  return -1;
}

static void CopyOneItem(CRecordVector<UInt64> &src, 
    CRecordVector<UInt64> &dest, UInt32 item)
{
  for (int i = 0; i < src.Size(); i++)
    if (src[i] == item)
    {
      dest.Add(item);
      src.Delete(i);
      return;
    }
}

static void RemoveOneItem(CRecordVector<UInt64> &src, UInt32 item)
{
  for (int i = 0; i < src.Size(); i++)
    if (src[i] == item)
    {
      src.Delete(i);
      return;
    }
}

static void InsertToHead(CRecordVector<UInt64> &dest, UInt32 item)
{
  for (int i = 0; i < dest.Size(); i++)
    if (dest[i] == item)
    {
      dest.Delete(i);
      break;
    }
  dest.Insert(0, item);
}

void CHandler::FillPopIDs()
{ 
  _fileInfoPopIDs.Clear();

  #ifdef _7Z_VOL
  if(_volumes.Size() < 1)
    return;
  const CVolume &volume = _volumes.Front();
  const CArchiveDatabaseEx &_database = volume.Database;
  #endif

  CRecordVector<UInt64> fileInfoPopIDs = _database.ArchiveInfo.FileInfoPopIDs;

  RemoveOneItem(fileInfoPopIDs, NID::kEmptyStream);
  RemoveOneItem(fileInfoPopIDs, NID::kEmptyFile);

  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kName);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kAnti);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kSize);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kPackInfo);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kCreationTime);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kLastWriteTime);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kLastAccessTime);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kWinAttributes);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kCRC);
  CopyOneItem(fileInfoPopIDs, _fileInfoPopIDs, NID::kComment);
  _fileInfoPopIDs += fileInfoPopIDs; 
 
  #ifndef _SFX
  _fileInfoPopIDs.Add(98);
  _fileInfoPopIDs.Add(99);
  #endif
  #ifdef _MULTI_PACK
  _fileInfoPopIDs.Add(100);
  _fileInfoPopIDs.Add(101);
  _fileInfoPopIDs.Add(102);
  _fileInfoPopIDs.Add(103);
  _fileInfoPopIDs.Add(104);
  #endif

  #ifndef _SFX
  InsertToHead(_fileInfoPopIDs, NID::kLastWriteTime);
  InsertToHead(_fileInfoPopIDs, NID::kPackInfo);
  InsertToHead(_fileInfoPopIDs, NID::kSize);
  InsertToHead(_fileInfoPopIDs, NID::kName);
  #endif
}

STDMETHODIMP CHandler::GetNumberOfProperties(UInt32 *numProperties)
{
  *numProperties = _fileInfoPopIDs.Size();
  return S_OK;
}

STDMETHODIMP CHandler::GetPropertyInfo(UInt32 index,     
      BSTR *name, PROPID *propID, VARTYPE *varType)
{
  if((int)index >= _fileInfoPopIDs.Size())
    return E_INVALIDARG;
  int indexInMap = FindPropInMap(_fileInfoPopIDs[index]);
  if (indexInMap == -1)
    return E_INVALIDARG;
  const STATPROPSTG &srcItem = kPropMap[indexInMap].StatPROPSTG;
  *propID = srcItem.propid;
  *varType = srcItem.vt;
  *name = 0;
  return S_OK;
}

}}
