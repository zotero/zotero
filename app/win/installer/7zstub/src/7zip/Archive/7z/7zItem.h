// 7zItem.h

#ifndef __7Z_ITEM_H
#define __7Z_ITEM_H

#include "../../../Common/Buffer.h"
#include "7zMethodID.h"
#include "7zHeader.h"

namespace NArchive {
namespace N7z {

struct CAltCoderInfo
{
  CMethodID MethodID;
  CByteBuffer Properties;
};

typedef UInt32 CNum;
const CNum kNumMax     = 0x7FFFFFFF;
const CNum kNumNoIndex = 0xFFFFFFFF;

struct CCoderInfo
{
  CNum NumInStreams;
  CNum NumOutStreams;
  CObjectVector<CAltCoderInfo> AltCoders;
  bool IsSimpleCoder() const { return (NumInStreams == 1) && (NumOutStreams == 1); }
};

struct CBindPair
{
  CNum InIndex;
  CNum OutIndex;
};

struct CFolder
{
  CObjectVector<CCoderInfo> Coders;
  CRecordVector<CBindPair> BindPairs;
  CRecordVector<CNum> PackStreams;
  CRecordVector<UInt64> UnPackSizes;
  UInt32 UnPackCRC;
  bool UnPackCRCDefined;

  CFolder(): UnPackCRCDefined(false) {}

  UInt64 GetUnPackSize() const // test it
  { 
    if (UnPackSizes.IsEmpty())
      return 0;
    for (int i = UnPackSizes.Size() - 1; i >= 0; i--)
      if (FindBindPairForOutStream(i) < 0)
        return UnPackSizes[i];
    throw 1;
  }

  CNum GetNumOutStreams() const
  {
    CNum result = 0;
    for (int i = 0; i < Coders.Size(); i++)
      result += Coders[i].NumOutStreams;
    return result;
  }

  int FindBindPairForInStream(CNum inStreamIndex) const
  {
    for(int i = 0; i < BindPairs.Size(); i++)
      if (BindPairs[i].InIndex == inStreamIndex)
        return i;
    return -1;
  }
  int FindBindPairForOutStream(CNum outStreamIndex) const
  {
    for(int i = 0; i < BindPairs.Size(); i++)
      if (BindPairs[i].OutIndex == outStreamIndex)
        return i;
    return -1;
  }
  int FindPackStreamArrayIndex(CNum inStreamIndex) const
  {
    for(int i = 0; i < PackStreams.Size(); i++)
      if (PackStreams[i] == inStreamIndex)
        return i;
    return -1;
  }
};

typedef FILETIME CArchiveFileTime;

class CFileItem
{
public:
  CArchiveFileTime CreationTime;
  CArchiveFileTime LastWriteTime;
  CArchiveFileTime LastAccessTime;
  UInt64 UnPackSize;
  UInt64 StartPos;
  UInt32 Attributes;
  UInt32 FileCRC;
  UString Name;

  bool HasStream; // Test it !!! it means that there is 
                  // stream in some folder. It can be empty stream
  bool IsDirectory;
  bool IsAnti;
  bool IsFileCRCDefined;
  bool AreAttributesDefined;
  bool IsCreationTimeDefined;
  bool IsLastWriteTimeDefined;
  bool IsLastAccessTimeDefined;
  bool IsStartPosDefined;

  /*
  const bool HasStream() const { 
      return !IsDirectory && !IsAnti && UnPackSize != 0; }
  */
  CFileItem(): 
    HasStream(true),
    IsDirectory(false),
    IsAnti(false),
    IsFileCRCDefined(false),
    AreAttributesDefined(false), 
    IsCreationTimeDefined(false), 
    IsLastWriteTimeDefined(false), 
    IsLastAccessTimeDefined(false),
    IsStartPosDefined(false)
      {}
  void SetAttributes(UInt32 attributes) 
  { 
    AreAttributesDefined = true;
    Attributes = attributes;
  }
  void SetCreationTime(const CArchiveFileTime &creationTime) 
  { 
    IsCreationTimeDefined = true;
    CreationTime = creationTime;
  }
  void SetLastWriteTime(const CArchiveFileTime &lastWriteTime) 
  {
    IsLastWriteTimeDefined = true;
    LastWriteTime = lastWriteTime;
  }
  void SetLastAccessTime(const CArchiveFileTime &lastAccessTime) 
  { 
    IsLastAccessTimeDefined = true;
    LastAccessTime = lastAccessTime;
  }
};

struct CArchiveDatabase
{
  CRecordVector<UInt64> PackSizes;
  CRecordVector<bool> PackCRCsDefined;
  CRecordVector<UInt32> PackCRCs;
  CObjectVector<CFolder> Folders;
  CRecordVector<CNum> NumUnPackStreamsVector;
  CObjectVector<CFileItem> Files;
  void Clear()
  {
    PackSizes.Clear();
    PackCRCsDefined.Clear();
    PackCRCs.Clear();
    Folders.Clear();
    NumUnPackStreamsVector.Clear();
    Files.Clear();
  }
  bool IsEmpty() const
  {
    return (PackSizes.IsEmpty() && 
      PackCRCsDefined.IsEmpty() && 
      PackCRCs.IsEmpty() && 
      Folders.IsEmpty() && 
      NumUnPackStreamsVector.IsEmpty() && 
      Files.IsEmpty());
  }
};

}}

#endif
