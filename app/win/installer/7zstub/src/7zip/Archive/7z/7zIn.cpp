// 7zIn.cpp

#include "StdAfx.h"

#include "7zIn.h"
#include "7zMethods.h"
#include "7zDecode.h"
#include "../../Common/StreamObjects.h"
#include "../../Common/StreamUtils.h"
#include "../../../Common/CRC.h"

namespace NArchive {
namespace N7z {

class CStreamSwitch
{
  CInArchive *_archive;
  bool _needRemove;
public:
  CStreamSwitch(): _needRemove(false) {}
  ~CStreamSwitch() { Remove(); }
  void Remove();
  void Set(CInArchive *archive, const Byte *data, size_t size);
  void Set(CInArchive *archive, const CByteBuffer &byteBuffer);
  HRESULT Set(CInArchive *archive, const CObjectVector<CByteBuffer> *dataVector);
};

void CStreamSwitch::Remove()
{
  if (_needRemove)
  {
    _archive->DeleteByteStream();
    _needRemove = false;
  }
}

void CStreamSwitch::Set(CInArchive *archive, const Byte *data, size_t size)
{
  Remove();
  _archive = archive;
  _archive->AddByteStream(data, size);
  _needRemove = true;
}

void CStreamSwitch::Set(CInArchive *archive, const CByteBuffer &byteBuffer)
{
  Set(archive, byteBuffer, byteBuffer.GetCapacity());
}

HRESULT CStreamSwitch::Set(CInArchive *archive, const CObjectVector<CByteBuffer> *dataVector)
{
  Remove();
  Byte external;
  RINOK(archive->ReadByte(external));
  if (external != 0)
  {
    CNum dataIndex;
    RINOK(archive->ReadNum(dataIndex));
    Set(archive, (*dataVector)[dataIndex]);
  }
  return S_OK;
}

  
CInArchiveException::CInArchiveException(CCauseType cause):
  Cause(cause)
{}

HRESULT CInArchive::ReadDirect(IInStream *stream, void *data, UInt32 size, 
    UInt32 *processedSize)
{
  UInt32 realProcessedSize;
  HRESULT result = ReadStream(stream, data, size, &realProcessedSize);
  if(processedSize != NULL)
    *processedSize = realProcessedSize;
  _position += realProcessedSize;
  return result;
}

HRESULT CInArchive::ReadDirect(void *data, UInt32 size, UInt32 *processedSize)
{
  return ReadDirect(_stream, data, size, processedSize);
}

HRESULT CInArchive::SafeReadDirect(void *data, UInt32 size)
{
  UInt32 realProcessedSize;
  RINOK(ReadDirect(data, size, &realProcessedSize));
  if (realProcessedSize != size)
    throw CInArchiveException(CInArchiveException::kUnexpectedEndOfArchive);
  return S_OK;
}

HRESULT CInArchive::SafeReadDirectByte(Byte &b)
{
  return SafeReadDirect(&b, 1);
}

HRESULT CInArchive::SafeReadDirectUInt32(UInt32 &value)
{
  value = 0;
  for (int i = 0; i < 4; i++)
  {
    Byte b;
    RINOK(SafeReadDirectByte(b));
    value |= (UInt32(b) << (8 * i));
  }
  return S_OK;
}

HRESULT CInArchive::SafeReadDirectUInt64(UInt64 &value)
{
  value = 0;
  for (int i = 0; i < 8; i++)
  {
    Byte b;
    RINOK(SafeReadDirectByte(b));
    value |= (UInt64(b) << (8 * i));
  }
  return S_OK;
}

HRESULT CInArchive::ReadNumber(UInt64 &value)
{
  Byte firstByte;
  RINOK(ReadByte(firstByte));
  Byte mask = 0x80;
  value = 0;
  for (int i = 0; i < 8; i++)
  {
    if ((firstByte & mask) == 0)
    {
      UInt64 highPart = firstByte & (mask - 1);
      value += (highPart << (i * 8));
      return S_OK;
    }
    Byte b;
    RINOK(ReadByte(b));
    value |= (UInt64(b) << (8 * i));
    mask >>= 1;
  }
  return S_OK;
}

HRESULT CInArchive::ReadNum(CNum &value)
{ 
  UInt64 value64;
  RINOK(ReadNumber(value64)); 
  if (value64 > kNumMax)
    return E_FAIL;
  value = (CNum)value64;
  return S_OK;
}

HRESULT CInArchive::ReadUInt32(UInt32 &value)
{
  value = 0;
  for (int i = 0; i < 4; i++)
  {
    Byte b;
    RINOK(ReadByte(b));
    value |= (UInt32(b) << (8 * i));
  }
  return S_OK;
}

HRESULT CInArchive::ReadUInt64(UInt64 &value)
{
  value = 0;
  for (int i = 0; i < 8; i++)
  {
    Byte b;
    RINOK(ReadByte(b));
    value |= (UInt64(b) << (8 * i));
  }
  return S_OK;
}

static inline bool TestSignatureCandidate(const void *testBytes)
{
  for (int i = 0; i < kSignatureSize; i++)
    if (((const Byte *)testBytes)[i] != kSignature[i])
      return false;
  return true;
}

#ifdef _7Z_VOL
static inline bool TestFinishSignatureCandidate(const void *testBytes)
{
  for (int i = 0; i < kSignatureSize; i++)
    if (((const Byte *)testBytes)[i] != kFinishSignature[i])
      return false;
  return true;
}
#endif

HRESULT CInArchive::FindAndReadSignature(IInStream *stream, const UInt64 *searchHeaderSizeLimit)
{
  _position = _arhiveBeginStreamPosition;
  RINOK(stream->Seek(_arhiveBeginStreamPosition, STREAM_SEEK_SET, NULL));

  Byte signature[kSignatureSize];
  UInt32 processedSize; 
  RINOK(ReadDirect(stream, signature, kSignatureSize, &processedSize));
  if(processedSize != kSignatureSize)
    return S_FALSE;
  if (TestSignatureCandidate(signature))
    return S_OK;

  CByteBuffer byteBuffer;
  const UInt32 kBufferSize = (1 << 16);
  byteBuffer.SetCapacity(kBufferSize);
  Byte *buffer = byteBuffer;
  UInt32 numPrevBytes = kSignatureSize - 1;
  memmove(buffer, signature + 1, numPrevBytes);
  UInt64 curTestPos = _arhiveBeginStreamPosition + 1;
  while(true)
  {
    if (searchHeaderSizeLimit != NULL)
      if (curTestPos - _arhiveBeginStreamPosition > *searchHeaderSizeLimit)
        return S_FALSE;
    UInt32 numReadBytes = kBufferSize - numPrevBytes;
    RINOK(ReadDirect(stream, buffer + numPrevBytes, numReadBytes, &processedSize));
    UInt32 numBytesInBuffer = numPrevBytes + processedSize;
    if (numBytesInBuffer < kSignatureSize)
      return S_FALSE;
    UInt32 numTests = numBytesInBuffer - kSignatureSize + 1;
    for(UInt32 pos = 0; pos < numTests; pos++, curTestPos++)
    { 
      if (TestSignatureCandidate(buffer + pos))
      {
        _arhiveBeginStreamPosition = curTestPos;
        _position = curTestPos + kSignatureSize;
        return stream->Seek(_position, STREAM_SEEK_SET, NULL);
      }
    }
    numPrevBytes = numBytesInBuffer - numTests;
    memmove(buffer, buffer + numTests, numPrevBytes);
  }
}

// Out: _position must point to end of signature

#ifdef _7Z_VOL
HRESULT CInArchive::FindFinishSignature(IInStream *stream, const UInt64 *searchHeaderSizeLimit)
{
  RINOK(stream->Seek(0, STREAM_SEEK_END, &_position));
  if (_position < kSignatureSize)
    return S_FALSE;

  CByteBuffer byteBuffer;
  const UInt32 kBufferSize = (1 << 18);
  byteBuffer.SetCapacity(kBufferSize);
  Byte *buffer = byteBuffer;
  UInt32 numPrevBytes = 0;
  UInt64 limitPos = 0;
  if (searchHeaderSizeLimit != NULL)
    if (*searchHeaderSizeLimit < _position)
      limitPos = _position - *searchHeaderSizeLimit;

  while(_position >= limitPos)
  {
    UInt32 numReadBytes = kBufferSize - numPrevBytes;
    if (numReadBytes > _position)
      numReadBytes = (UInt32)_position;
    UInt32 numBytesInBuffer = numPrevBytes + numReadBytes;
    if (numBytesInBuffer < kSignatureSize)
      return S_FALSE;
    _position -= numReadBytes;
    RINOK(stream->Seek(_position, STREAM_SEEK_SET, &_position));
    UInt32 startPos = kBufferSize - numBytesInBuffer;
    UInt32 processedSize;
    RINOK(ReadDirect(stream, buffer + startPos, numReadBytes, &processedSize));
    if (processedSize != numReadBytes)
      return S_FALSE;
    _position -= processedSize;
    for(UInt32 pos = kBufferSize; pos >= startPos + kSignatureSize; pos--)
    { 
      if (TestFinishSignatureCandidate(buffer + pos - kSignatureSize))
      {
        _position += pos - startPos;
        return stream->Seek(_position, STREAM_SEEK_SET, NULL);
      }
    }
    numPrevBytes = kSignatureSize - 1;
    memmove(buffer + kBufferSize - numPrevBytes, buffer + startPos + 1, numPrevBytes);
  }
  return S_FALSE;
}
#endif

// S_FALSE means that file is not archive
HRESULT CInArchive::Open(IInStream *stream, const UInt64 *searchHeaderSizeLimit)
{
  Close();
  RINOK(stream->Seek(0, STREAM_SEEK_CUR, &_arhiveBeginStreamPosition))
  _position = _arhiveBeginStreamPosition;
  #ifdef _7Z_VOL
  HRESULT result = FindFinishSignature(stream, searchHeaderSizeLimit);
  if (result == S_OK)
    _finishSignature = true;
  else
  {
    if (result != S_FALSE)
      return result;
    _finishSignature = false;
    RINOK(FindAndReadSignature(stream, searchHeaderSizeLimit));
  }
  #else
  RINOK(FindAndReadSignature(stream, searchHeaderSizeLimit));
  #endif
  _stream = stream;
  return S_OK;
}
  
void CInArchive::Close()
{
  _stream.Release();
}

HRESULT CInArchive::SkeepData(UInt64 size)
{
  for (UInt64 i = 0; i < size; i++)
  {
    Byte temp;
    RINOK(ReadByte(temp));
  }
  return S_OK;
}

HRESULT CInArchive::SkeepData()
{
  UInt64 size;
  RINOK(ReadNumber(size));
  return SkeepData(size);
}

HRESULT CInArchive::ReadArchiveProperties(CInArchiveInfo &archiveInfo)
{
  while(true)
  {
    UInt64 type;
    RINOK(ReadID(type));
    if (type == NID::kEnd)
      break;
    SkeepData();
  }
  return S_OK;
}

HRESULT CInArchive::GetNextFolderItem(CFolder &folder)
{
  CNum numCoders;
  RINOK(ReadNum(numCoders));

  folder.Coders.Clear();
  folder.Coders.Reserve((int)numCoders);
  CNum numInStreams = 0;
  CNum numOutStreams = 0;
  CNum i;
  for (i = 0; i < numCoders; i++)
  {
    folder.Coders.Add(CCoderInfo());
    CCoderInfo &coder = folder.Coders.Back();

    while (true)
    {
      coder.AltCoders.Add(CAltCoderInfo());
      CAltCoderInfo &altCoder = coder.AltCoders.Back();
      Byte mainByte;
      RINOK(ReadByte(mainByte));
      altCoder.MethodID.IDSize = mainByte & 0xF;
      RINOK(ReadBytes(altCoder.MethodID.ID, altCoder.MethodID.IDSize));
      if ((mainByte & 0x10) != 0)
      {
        RINOK(ReadNum(coder.NumInStreams));
        RINOK(ReadNum(coder.NumOutStreams));
      }
      else
      {
        coder.NumInStreams = 1;
        coder.NumOutStreams = 1;
      }
      if ((mainByte & 0x20) != 0)
      {
        CNum propertiesSize = 0;
        RINOK(ReadNum(propertiesSize));
        altCoder.Properties.SetCapacity((size_t)propertiesSize);
        RINOK(ReadBytes((Byte *)altCoder.Properties, (size_t)propertiesSize));
      }
      if ((mainByte & 0x80) == 0)
        break;
    }
    numInStreams += coder.NumInStreams;
    numOutStreams += coder.NumOutStreams;
  }

  CNum numBindPairs;
  // RINOK(ReadNumber(numBindPairs));
  numBindPairs = numOutStreams - 1;
  folder.BindPairs.Clear();
  folder.BindPairs.Reserve(numBindPairs);
  for (i = 0; i < numBindPairs; i++)
  {
    CBindPair bindPair;
    RINOK(ReadNum(bindPair.InIndex));
    RINOK(ReadNum(bindPair.OutIndex)); 
    folder.BindPairs.Add(bindPair);
  }

  CNum numPackedStreams = numInStreams - numBindPairs;
  folder.PackStreams.Reserve(numPackedStreams);
  if (numPackedStreams == 1)
  {
    for (CNum j = 0; j < numInStreams; j++)
      if (folder.FindBindPairForInStream(j) < 0)
      {
        folder.PackStreams.Add(j);
        break;
      }
  }
  else
    for(i = 0; i < numPackedStreams; i++)
    {
      CNum packStreamInfo;
      RINOK(ReadNum(packStreamInfo));
      folder.PackStreams.Add(packStreamInfo);
    }

  return S_OK;
}

HRESULT CInArchive::WaitAttribute(UInt64 attribute)
{
  while(true)
  {
    UInt64 type;
    RINOK(ReadID(type));
    if (type == attribute)
      return S_OK;
    if (type == NID::kEnd)
      return S_FALSE;
    RINOK(SkeepData());
  }
}

HRESULT CInArchive::ReadHashDigests(int numItems,
    CRecordVector<bool> &digestsDefined, 
    CRecordVector<UInt32> &digests)
{
  RINOK(ReadBoolVector2(numItems, digestsDefined));
  digests.Clear();
  digests.Reserve(numItems);
  for(int i = 0; i < numItems; i++)
  {
    UInt32 crc;
    if (digestsDefined[i])
      RINOK(ReadUInt32(crc));
    digests.Add(crc);
  }
  return S_OK;
}

HRESULT CInArchive::ReadPackInfo(
    UInt64 &dataOffset,
    CRecordVector<UInt64> &packSizes,
    CRecordVector<bool> &packCRCsDefined,
    CRecordVector<UInt32> &packCRCs)
{
  RINOK(ReadNumber(dataOffset));
  CNum numPackStreams;
  RINOK(ReadNum(numPackStreams));

  RINOK(WaitAttribute(NID::kSize));
  packSizes.Clear();
  packSizes.Reserve(numPackStreams);
  for(CNum i = 0; i < numPackStreams; i++)
  {
    UInt64 size;
    RINOK(ReadNumber(size));
    packSizes.Add(size);
  }

  UInt64 type;
  while(true)
  {
    RINOK(ReadID(type));
    if (type == NID::kEnd)
      break;
    if (type == NID::kCRC)
    {
      RINOK(ReadHashDigests(numPackStreams, packCRCsDefined, packCRCs)); 
      continue;
    }
    RINOK(SkeepData());
  }
  if (packCRCsDefined.IsEmpty())
  {
    packCRCsDefined.Reserve(numPackStreams);
    packCRCsDefined.Clear();
    packCRCs.Reserve(numPackStreams);
    packCRCs.Clear();
    for(CNum i = 0; i < numPackStreams; i++)
    {
      packCRCsDefined.Add(false);
      packCRCs.Add(0);
    }
  }
  return S_OK;
}

HRESULT CInArchive::ReadUnPackInfo(
    const CObjectVector<CByteBuffer> *dataVector,
    CObjectVector<CFolder> &folders)
{
  RINOK(WaitAttribute(NID::kFolder));
  CNum numFolders;
  RINOK(ReadNum(numFolders));

  {
    CStreamSwitch streamSwitch;
    RINOK(streamSwitch.Set(this, dataVector));
    folders.Clear();
    folders.Reserve((UInt32)numFolders);
    for(CNum i = 0; i < numFolders; i++)
    {
      folders.Add(CFolder());
      RINOK(GetNextFolderItem(folders.Back()));
    }
  }

  RINOK(WaitAttribute(NID::kCodersUnPackSize));

  CNum i;
  for(i = 0; i < numFolders; i++)
  {
    CFolder &folder = folders[i];
    CNum numOutStreams = folder.GetNumOutStreams();
    folder.UnPackSizes.Reserve(numOutStreams);
    for(CNum j = 0; j < numOutStreams; j++)
    {
      UInt64 unPackSize;
      RINOK(ReadNumber(unPackSize));
      folder.UnPackSizes.Add(unPackSize);
    }
  }

  while(true)
  {
    UInt64 type;
    RINOK(ReadID(type));
    if (type == NID::kEnd)
      return S_OK;
    if (type == NID::kCRC)
    {
      CRecordVector<bool> crcsDefined;
      CRecordVector<UInt32> crcs;
      RINOK(ReadHashDigests(numFolders, crcsDefined, crcs)); 
      for(i = 0; i < numFolders; i++)
      {
        CFolder &folder = folders[i];
        folder.UnPackCRCDefined = crcsDefined[i];
        folder.UnPackCRC = crcs[i];
      }
      continue;
    }
    RINOK(SkeepData());
  }
}

HRESULT CInArchive::ReadSubStreamsInfo(
    const CObjectVector<CFolder> &folders,
    CRecordVector<CNum> &numUnPackStreamsInFolders,
    CRecordVector<UInt64> &unPackSizes,
    CRecordVector<bool> &digestsDefined, 
    CRecordVector<UInt32> &digests)
{
  numUnPackStreamsInFolders.Clear();
  numUnPackStreamsInFolders.Reserve(folders.Size());
  UInt64 type;
  while(true)
  {
    RINOK(ReadID(type));
    if (type == NID::kNumUnPackStream)
    {
      for(int i = 0; i < folders.Size(); i++)
      {
        CNum value;
        RINOK(ReadNum(value));
        numUnPackStreamsInFolders.Add(value);
      }
      continue;
    }
    if (type == NID::kCRC || type == NID::kSize)
      break;
    if (type == NID::kEnd)
      break;
    RINOK(SkeepData());
  }

  if (numUnPackStreamsInFolders.IsEmpty())
    for(int i = 0; i < folders.Size(); i++)
      numUnPackStreamsInFolders.Add(1);

  int i;
  for(i = 0; i < numUnPackStreamsInFolders.Size(); i++)
  {
    // v3.13 incorrectly worked with empty folders
    // v4.07: we check that folder is empty
    CNum numSubstreams = numUnPackStreamsInFolders[i];
    if (numSubstreams == 0)
      continue;
    UInt64 sum = 0;
    for (CNum j = 1; j < numSubstreams; j++)
    {
      UInt64 size;
      if (type == NID::kSize)
      {
        RINOK(ReadNumber(size));
        unPackSizes.Add(size);
        sum += size;
      }
    }
    unPackSizes.Add(folders[i].GetUnPackSize() - sum);
  }
  if (type == NID::kSize)
  {
    RINOK(ReadID(type));
  }

  int numDigests = 0;
  int numDigestsTotal = 0;
  for(i = 0; i < folders.Size(); i++)
  {
    CNum numSubstreams = numUnPackStreamsInFolders[i];
    if (numSubstreams != 1 || !folders[i].UnPackCRCDefined)
      numDigests += numSubstreams;
    numDigestsTotal += numSubstreams;
  }

  while(true)
  {
    if (type == NID::kCRC)
    {
      CRecordVector<bool> digestsDefined2; 
      CRecordVector<UInt32> digests2;
      RINOK(ReadHashDigests(numDigests, digestsDefined2, digests2));
      int digestIndex = 0;
      for (i = 0; i < folders.Size(); i++)
      {
        CNum numSubstreams = numUnPackStreamsInFolders[i];
        const CFolder &folder = folders[i];
        if (numSubstreams == 1 && folder.UnPackCRCDefined)
        {
          digestsDefined.Add(true);
          digests.Add(folder.UnPackCRC);
        }
        else
          for (CNum j = 0; j < numSubstreams; j++, digestIndex++)
          {
            digestsDefined.Add(digestsDefined2[digestIndex]);
            digests.Add(digests2[digestIndex]);
          }
      }
    }
    else if (type == NID::kEnd)
    {
      if (digestsDefined.IsEmpty())
      {
        digestsDefined.Clear();
        digests.Clear();
        for (int i = 0; i < numDigestsTotal; i++)
        {
          digestsDefined.Add(false);
          digests.Add(0);
        }
      }
      return S_OK;
    }
    else
    {
      RINOK(SkeepData());
    }
    RINOK(ReadID(type));
  }
}

HRESULT CInArchive::ReadStreamsInfo(
    const CObjectVector<CByteBuffer> *dataVector,
    UInt64 &dataOffset,
    CRecordVector<UInt64> &packSizes,
    CRecordVector<bool> &packCRCsDefined,
    CRecordVector<UInt32> &packCRCs,
    CObjectVector<CFolder> &folders,
    CRecordVector<CNum> &numUnPackStreamsInFolders,
    CRecordVector<UInt64> &unPackSizes,
    CRecordVector<bool> &digestsDefined, 
    CRecordVector<UInt32> &digests)
{
  while(true)
  {
    UInt64 type;
    RINOK(ReadID(type));
    switch(type)
    {
      case NID::kEnd:
        return S_OK;
      case NID::kPackInfo:
      {
        RINOK(ReadPackInfo(dataOffset, packSizes,
            packCRCsDefined, packCRCs));
        break;
      }
      case NID::kUnPackInfo:
      {
        RINOK(ReadUnPackInfo(dataVector, folders));
        break;
      }
      case NID::kSubStreamsInfo:
      {
        RINOK(ReadSubStreamsInfo(folders, numUnPackStreamsInFolders,
          unPackSizes, digestsDefined, digests));
        break;
      }
    }
  }
}

HRESULT CInArchive::ReadFileNames(CObjectVector<CFileItem> &files)
{
  for(int i = 0; i < files.Size(); i++)
  {
    UString &name = files[i].Name;
    name.Empty();
    while (true)
    {
      wchar_t c;
      RINOK(ReadWideCharLE(c));
      if (c == L'\0')
        break;
      name += c;
    }
  }
  return S_OK;
}

HRESULT CInArchive::ReadBoolVector(int numItems, CBoolVector &v)
{
  v.Clear();
  v.Reserve(numItems);
  Byte b;
  Byte mask = 0;
  for(int i = 0; i < numItems; i++)
  {
    if (mask == 0)
    {
      RINOK(ReadByte(b));
      mask = 0x80;
    }
    v.Add((b & mask) != 0);
    mask >>= 1;
  }
  return S_OK;
}

HRESULT CInArchive::ReadBoolVector2(int numItems, CBoolVector &v)
{
  Byte allAreDefined;
  RINOK(ReadByte(allAreDefined));
  if (allAreDefined == 0)
    return ReadBoolVector(numItems, v);
  v.Clear();
  v.Reserve(numItems);
  for (int i = 0; i < numItems; i++)
    v.Add(true);
  return S_OK;
}

HRESULT CInArchive::ReadTime(const CObjectVector<CByteBuffer> &dataVector,
    CObjectVector<CFileItem> &files, UInt64 type)
{
  CBoolVector boolVector;
  RINOK(ReadBoolVector2(files.Size(), boolVector))

  CStreamSwitch streamSwitch;
  RINOK(streamSwitch.Set(this, &dataVector));

  for(int i = 0; i < files.Size(); i++)
  {
    CFileItem &file = files[i];
    CArchiveFileTime fileTime;
    bool defined = boolVector[i];
    if (defined)
    {
      UInt32 low, high;
      RINOK(ReadUInt32(low));
      RINOK(ReadUInt32(high));
      fileTime.dwLowDateTime = low;
      fileTime.dwHighDateTime = high;
    }
    switch(type)
    {
      case NID::kCreationTime:
        file.IsCreationTimeDefined = defined;
        if (defined)
          file.CreationTime = fileTime;
        break;
      case NID::kLastWriteTime:
        file.IsLastWriteTimeDefined = defined;
        if (defined)
          file.LastWriteTime = fileTime;
        break;
      case NID::kLastAccessTime:
        file.IsLastAccessTimeDefined = defined;
        if (defined)
          file.LastAccessTime = fileTime;
        break;
    }
  }
  return S_OK;
}

HRESULT CInArchive::ReadAndDecodePackedStreams(UInt64 baseOffset, 
    UInt64 &dataOffset, CObjectVector<CByteBuffer> &dataVector
    #ifndef _NO_CRYPTO
    , ICryptoGetTextPassword *getTextPassword
    #endif
    )
{
  CRecordVector<UInt64> packSizes;
  CRecordVector<bool> packCRCsDefined;
  CRecordVector<UInt32> packCRCs;
  CObjectVector<CFolder> folders;
  
  CRecordVector<CNum> numUnPackStreamsInFolders;
  CRecordVector<UInt64> unPackSizes;
  CRecordVector<bool> digestsDefined;
  CRecordVector<UInt32> digests;
  
  RINOK(ReadStreamsInfo(NULL, 
    dataOffset,
    packSizes, 
    packCRCsDefined, 
    packCRCs, 
    folders,
    numUnPackStreamsInFolders,
    unPackSizes,
    digestsDefined, 
    digests));
  
  // database.ArchiveInfo.DataStartPosition2 += database.ArchiveInfo.StartPositionAfterHeader;
  
  CNum packIndex = 0;
  CDecoder decoder(
    #ifdef _ST_MODE
    false
    #else
    true
    #endif
    );
  UInt64 dataStartPos = baseOffset + dataOffset;
  for(int i = 0; i < folders.Size(); i++)
  {
    const CFolder &folder = folders[i];
    dataVector.Add(CByteBuffer());
    CByteBuffer &data = dataVector.Back();
    UInt64 unPackSize = folder.GetUnPackSize();
    if (unPackSize > kNumMax)
      return E_FAIL;
    if (unPackSize > 0xFFFFFFFF)
      return E_FAIL;
    data.SetCapacity((size_t)unPackSize);
    
    CSequentialOutStreamImp2 *outStreamSpec = new CSequentialOutStreamImp2;
    CMyComPtr<ISequentialOutStream> outStream = outStreamSpec;
    outStreamSpec->Init(data, (size_t)unPackSize);
    
    HRESULT result = decoder.Decode(_stream, dataStartPos, 
      &packSizes[packIndex], folder, outStream, NULL
      #ifndef _NO_CRYPTO
      , getTextPassword
      #endif
      #ifdef COMPRESS_MT
      , false, 1
      #endif
      );
    RINOK(result);
    
    if (folder.UnPackCRCDefined)
      if (!CCRC::VerifyDigest(folder.UnPackCRC, data, (UInt32)unPackSize))
        throw CInArchiveException(CInArchiveException::kIncorrectHeader);
      for (int j = 0; j < folder.PackStreams.Size(); j++)
        dataStartPos += packSizes[packIndex++];
  }
  return S_OK;
}

HRESULT CInArchive::ReadHeader(CArchiveDatabaseEx &database
    #ifndef _NO_CRYPTO
    , ICryptoGetTextPassword *getTextPassword
    #endif
    )
{
  UInt64 type;
  RINOK(ReadID(type));

  if (type == NID::kArchiveProperties)
  {
    RINOK(ReadArchiveProperties(database.ArchiveInfo));
    RINOK(ReadID(type));
  }
 
  CObjectVector<CByteBuffer> dataVector;
  
  if (type == NID::kAdditionalStreamsInfo)
  {
    HRESULT result = ReadAndDecodePackedStreams(
        database.ArchiveInfo.StartPositionAfterHeader, 
        database.ArchiveInfo.DataStartPosition2,
        dataVector
        #ifndef _NO_CRYPTO
        , getTextPassword
        #endif
        );
    RINOK(result);
    database.ArchiveInfo.DataStartPosition2 += database.ArchiveInfo.StartPositionAfterHeader;
    RINOK(ReadID(type));
  }

  CRecordVector<UInt64> unPackSizes;
  CRecordVector<bool> digestsDefined;
  CRecordVector<UInt32> digests;
  
  if (type == NID::kMainStreamsInfo)
  {
    RINOK(ReadStreamsInfo(&dataVector,
        database.ArchiveInfo.DataStartPosition,
        database.PackSizes, 
        database.PackCRCsDefined, 
        database.PackCRCs, 
        database.Folders,
        database.NumUnPackStreamsVector,
        unPackSizes,
        digestsDefined,
        digests));
    database.ArchiveInfo.DataStartPosition += database.ArchiveInfo.StartPositionAfterHeader;
    RINOK(ReadID(type));
  }
  else
  {
    for(int i = 0; i < database.Folders.Size(); i++)
    {
      database.NumUnPackStreamsVector.Add(1);
      CFolder &folder = database.Folders[i];
      unPackSizes.Add(folder.GetUnPackSize());
      digestsDefined.Add(folder.UnPackCRCDefined);
      digests.Add(folder.UnPackCRC);
    }
  }

  database.Files.Clear();

  if (type == NID::kEnd)
    return S_OK;
  if (type != NID::kFilesInfo)
    throw CInArchiveException(CInArchiveException::kIncorrectHeader);
  
  CNum numFiles;
  RINOK(ReadNum(numFiles));
  database.Files.Reserve(numFiles);
  CNum i;
  for(i = 0; i < numFiles; i++)
    database.Files.Add(CFileItem());

  database.ArchiveInfo.FileInfoPopIDs.Add(NID::kSize);
  if (!database.PackSizes.IsEmpty())
    database.ArchiveInfo.FileInfoPopIDs.Add(NID::kPackInfo);
  if (numFiles > 0  && !digests.IsEmpty())
    database.ArchiveInfo.FileInfoPopIDs.Add(NID::kCRC);

  CBoolVector emptyStreamVector;
  emptyStreamVector.Reserve((int)numFiles);
  for(i = 0; i < numFiles; i++)
    emptyStreamVector.Add(false);
  CBoolVector emptyFileVector;
  CBoolVector antiFileVector;
  CNum numEmptyStreams = 0;

  // int sizePrev = -1;
  // int posPrev = 0;

  while(true)
  {
    /*
    if (sizePrev >= 0)
      if (sizePrev != _inByteBack->GetProcessedSize() - posPrev)
        throw 2;
    */
    UInt64 type;
    RINOK(ReadID(type));
    if (type == NID::kEnd)
      break;
    UInt64 size;
    RINOK(ReadNumber(size));
    
    // sizePrev = size;
    // posPrev = _inByteBack->GetProcessedSize();

    database.ArchiveInfo.FileInfoPopIDs.Add(type);
    switch(type)
    {
      case NID::kName:
      {
        CStreamSwitch streamSwitch;
        RINOK(streamSwitch.Set(this, &dataVector));
        RINOK(ReadFileNames(database.Files))
        break;
      }
      case NID::kWinAttributes:
      {
        CBoolVector boolVector;
        RINOK(ReadBoolVector2(database.Files.Size(), boolVector))
        CStreamSwitch streamSwitch;
        RINOK(streamSwitch.Set(this, &dataVector));
        for(i = 0; i < numFiles; i++)
        {
          CFileItem &file = database.Files[i];
          if (file.AreAttributesDefined = boolVector[i])
          {
            RINOK(ReadUInt32(file.Attributes));
          }
        }
        break;
      }
      case NID::kStartPos:
      {
        CBoolVector boolVector;
        RINOK(ReadBoolVector2(database.Files.Size(), boolVector))
        CStreamSwitch streamSwitch;
        RINOK(streamSwitch.Set(this, &dataVector));
        for(i = 0; i < numFiles; i++)
        {
          CFileItem &file = database.Files[i];
          if (file.IsStartPosDefined = boolVector[i])
          {
            RINOK(ReadUInt64(file.StartPos));
          }
        }
        break;
      }
      case NID::kEmptyStream:
      {
        RINOK(ReadBoolVector(numFiles, emptyStreamVector))
        for (i = 0; i < (CNum)emptyStreamVector.Size(); i++)
          if (emptyStreamVector[i])
            numEmptyStreams++;
        emptyFileVector.Reserve(numEmptyStreams);
        antiFileVector.Reserve(numEmptyStreams);
        for (i = 0; i < numEmptyStreams; i++)
        {
          emptyFileVector.Add(false);
          antiFileVector.Add(false);
        }
        break;
      }
      case NID::kEmptyFile:
      {
        RINOK(ReadBoolVector(numEmptyStreams, emptyFileVector))
        break;
      }
      case NID::kAnti:
      {
        RINOK(ReadBoolVector(numEmptyStreams, antiFileVector))
        break;
      }
      case NID::kCreationTime:
      case NID::kLastWriteTime:
      case NID::kLastAccessTime:
      {
        RINOK(ReadTime(dataVector, database.Files, type))
        break;
      }
      default:
      {
        database.ArchiveInfo.FileInfoPopIDs.DeleteBack();
        RINOK(SkeepData(size));
      }
    }
  }

  CNum emptyFileIndex = 0;
  CNum sizeIndex = 0;
  for(i = 0; i < numFiles; i++)
  {
    CFileItem &file = database.Files[i];
    file.HasStream = !emptyStreamVector[i];
    if(file.HasStream)
    {
      file.IsDirectory = false;
      file.IsAnti = false;
      file.UnPackSize = unPackSizes[sizeIndex];
      file.FileCRC = digests[sizeIndex];
      file.IsFileCRCDefined = digestsDefined[sizeIndex];
      sizeIndex++;
    }
    else
    {
      file.IsDirectory = !emptyFileVector[emptyFileIndex];
      file.IsAnti = antiFileVector[emptyFileIndex];
      emptyFileIndex++;
      file.UnPackSize = 0;
      file.IsFileCRCDefined = false;
    }
  }
  return S_OK;
}


void CArchiveDatabaseEx::FillFolderStartPackStream()
{
  FolderStartPackStreamIndex.Clear();
  FolderStartPackStreamIndex.Reserve(Folders.Size());
  CNum startPos = 0;
  for(int i = 0; i < Folders.Size(); i++)
  {
    FolderStartPackStreamIndex.Add(startPos);
    startPos += (CNum)Folders[i].PackStreams.Size();
  }
}

void CArchiveDatabaseEx::FillStartPos()
{
  PackStreamStartPositions.Clear();
  PackStreamStartPositions.Reserve(PackSizes.Size());
  UInt64 startPos = 0;
  for(int i = 0; i < PackSizes.Size(); i++)
  {
    PackStreamStartPositions.Add(startPos);
    startPos += PackSizes[i];
  }
}

void CArchiveDatabaseEx::FillFolderStartFileIndex()
{
  FolderStartFileIndex.Clear();
  FolderStartFileIndex.Reserve(Folders.Size());
  FileIndexToFolderIndexMap.Clear();
  FileIndexToFolderIndexMap.Reserve(Files.Size());
  
  int folderIndex = 0;
  CNum indexInFolder = 0;
  for (int i = 0; i < Files.Size(); i++)
  {
    const CFileItem &file = Files[i];
    bool emptyStream = !file.HasStream;
    if (emptyStream && indexInFolder == 0)
    {
      FileIndexToFolderIndexMap.Add(kNumNoIndex);
      continue;
    }
    if (indexInFolder == 0)
    {
      // v3.13 incorrectly worked with empty folders
      // v4.07: Loop for skipping empty folders
      while(true)
      {
        if (folderIndex >= Folders.Size())
          throw CInArchiveException(CInArchiveException::kIncorrectHeader);
        FolderStartFileIndex.Add(i); // check it
        if (NumUnPackStreamsVector[folderIndex] != 0)
          break;
        folderIndex++;
      }
    }
    FileIndexToFolderIndexMap.Add(folderIndex);
    if (emptyStream)
      continue;
    indexInFolder++;
    if (indexInFolder >= NumUnPackStreamsVector[folderIndex])
    {
      folderIndex++;
      indexInFolder = 0;
    }
  }
}

HRESULT CInArchive::ReadDatabase(CArchiveDatabaseEx &database
    #ifndef _NO_CRYPTO
    , ICryptoGetTextPassword *getTextPassword
    #endif
    )
{
  database.Clear();
  database.ArchiveInfo.StartPosition = _arhiveBeginStreamPosition;


  RINOK(SafeReadDirect(&database.ArchiveInfo.Version.Major, 1));
  RINOK(SafeReadDirect(&database.ArchiveInfo.Version.Minor, 1));
  if (database.ArchiveInfo.Version.Major != kMajorVersion)
    throw  CInArchiveException(CInArchiveException::kUnsupportedVersion);

  #ifdef _7Z_VOL
  if (_finishSignature)
  {
    RINOK(_stream->Seek(_position - (4 + kFinishHeaderSize) - 
        (kSignatureSize + 2), STREAM_SEEK_SET, &_position));
  }
  #endif

  UInt32 crcFromArchive;
  RINOK(SafeReadDirectUInt32(crcFromArchive));

  UInt64 nextHeaderOffset;
  UInt64 nextHeaderSize;
  UInt32 nextHeaderCRC;
  CCRC crc;
  RINOK(SafeReadDirectUInt64(nextHeaderOffset));
  crc.UpdateUInt64(nextHeaderOffset);
  RINOK(SafeReadDirectUInt64(nextHeaderSize));
  crc.UpdateUInt64(nextHeaderSize);
  RINOK(SafeReadDirectUInt32(nextHeaderCRC));
  crc.UpdateUInt32(nextHeaderCRC);

  #ifdef _7Z_VOL
  UInt64 archiveStartOffset;  // data offset from end if that struct
  UInt64 additionalStartBlockSize; // start  signature & start header size
  if (_finishSignature)
  {
    RINOK(SafeReadDirectUInt64(archiveStartOffset));
    crc.UpdateUInt64(archiveStartOffset);
    RINOK(SafeReadDirectUInt64(additionalStartBlockSize));
    crc.UpdateUInt64(additionalStartBlockSize);
    database.ArchiveInfo.StartPositionAfterHeader = _position + archiveStartOffset;
  }
  else
  #endif
  {
    database.ArchiveInfo.StartPositionAfterHeader = _position;
  }
  if (crc.GetDigest() != crcFromArchive)
    throw CInArchiveException(CInArchiveException::kIncorrectHeader);

  if (nextHeaderSize == 0)
    return S_OK;

  if (nextHeaderSize >= 0xFFFFFFFF)
    return E_FAIL;

  RINOK(_stream->Seek(nextHeaderOffset, STREAM_SEEK_CUR, &_position));

  CByteBuffer buffer2;
  buffer2.SetCapacity((size_t)nextHeaderSize);
  RINOK(SafeReadDirect(buffer2, (UInt32)nextHeaderSize));
  if (!CCRC::VerifyDigest(nextHeaderCRC, buffer2, (UInt32)nextHeaderSize))
    throw CInArchiveException(CInArchiveException::kIncorrectHeader);
  
  CStreamSwitch streamSwitch;
  streamSwitch.Set(this, buffer2);
  
  CObjectVector<CByteBuffer> dataVector;
  
  while (true)
  {
    UInt64 type;
    RINOK(ReadID(type));
    if (type == NID::kHeader)
      break;
    if (type != NID::kEncodedHeader)
      throw CInArchiveException(CInArchiveException::kIncorrectHeader);
    HRESULT result = ReadAndDecodePackedStreams(
        database.ArchiveInfo.StartPositionAfterHeader, 
        database.ArchiveInfo.DataStartPosition2,
        dataVector
        #ifndef _NO_CRYPTO
        , getTextPassword
        #endif
        );
    RINOK(result);
    if (dataVector.Size() == 0)
      return S_OK;
    if (dataVector.Size() > 1)
      throw CInArchiveException(CInArchiveException::kIncorrectHeader);
    streamSwitch.Remove();
    streamSwitch.Set(this, dataVector.Front());
  }

  return ReadHeader(database
    #ifndef _NO_CRYPTO
    , getTextPassword
    #endif
    );
}

}}
