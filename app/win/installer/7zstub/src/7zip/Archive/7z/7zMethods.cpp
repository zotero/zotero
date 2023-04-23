// 7zMethods.cpp

#include "StdAfx.h"

#include "7zMethods.h"

#include "../../../Windows/FileFind.h"
#include "../../../Windows/DLL.h"
#include "../../../Windows/PropVariant.h"
#include "../../../Windows/Synchronization.h"

#include "../../ICoder.h"
#include "../Common/CodecsPath.h"

using namespace NWindows;

namespace NArchive {
namespace N7z {

static CObjectVector<CMethodInfo2> g_Methods;
static bool g_Loaded = false;

typedef UInt32 (WINAPI *GetNumberOfMethodsFunc)(UInt32 *numMethods);

typedef UInt32 (WINAPI *GetMethodPropertyFunc)(
    UInt32 index, PROPID propID, PROPVARIANT *value);

static void Load(const CSysString &folderPrefix)
{
  NFile::NFind::CEnumerator enumerator(folderPrefix + CSysString(TEXT("*")));
  NFile::NFind::CFileInfo fileInfo;
  while (enumerator.Next(fileInfo))
  {
    if (fileInfo.IsDirectory())
      continue;
    CSysString filePath = folderPrefix + fileInfo.Name;
    {
      NDLL::CLibrary library;
      if (!library.LoadEx(filePath, LOAD_LIBRARY_AS_DATAFILE))
        continue;
    }
    NDLL::CLibrary library;
    if (!library.Load(filePath))
      continue;
    GetMethodPropertyFunc getMethodProperty = (GetMethodPropertyFunc)
        library.GetProcAddress("GetMethodProperty");
    if (getMethodProperty == NULL)
      continue;

    UInt32 numMethods = 1;
    GetNumberOfMethodsFunc getNumberOfMethodsFunc = (GetNumberOfMethodsFunc)
        library.GetProcAddress("GetNumberOfMethods");
    if (getNumberOfMethodsFunc != NULL)
      if (getNumberOfMethodsFunc(&numMethods) != S_OK)
        continue;

    for(UInt32 i = 0; i < numMethods; i++)
    {
      CMethodInfo2 info;
      info.FilePath = filePath;
      
      NWindows::NCOM::CPropVariant propVariant;
      if (getMethodProperty(i, NMethodPropID::kID, &propVariant) != S_OK)
        continue;
      if (propVariant.vt != VT_BSTR)
        continue;
      info.MethodID.IDSize = SysStringByteLen(propVariant.bstrVal);
      memmove(info.MethodID.ID, propVariant.bstrVal, info.MethodID.IDSize);
      propVariant.Clear();
      
      if (getMethodProperty(i, NMethodPropID::kName, &propVariant) != S_OK)
        continue;
      if (propVariant.vt == VT_EMPTY)
      {
      }
      else if (propVariant.vt == VT_BSTR)
        info.Name = propVariant.bstrVal;
      else
        continue;
      propVariant.Clear();
      
      if (getMethodProperty (i, NMethodPropID::kEncoder, &propVariant) != S_OK)
        continue;
      if (propVariant.vt == VT_EMPTY)
        info.EncoderIsAssigned = false;
      else if (propVariant.vt == VT_BSTR)
      {
        info.EncoderIsAssigned = true;
        info.Encoder = *(const GUID *)propVariant.bstrVal;
      }
      else
        continue;
      propVariant.Clear();
      
      if (getMethodProperty (i, NMethodPropID::kDecoder, &propVariant) != S_OK)
        continue;
      if (propVariant.vt == VT_EMPTY)
        info.DecoderIsAssigned = false;
      else if (propVariant.vt == VT_BSTR)
      {
        info.DecoderIsAssigned = true;
        info.Decoder = *(const GUID *)propVariant.bstrVal;
      }
      else
        continue;
      propVariant.Clear();
      
      if (getMethodProperty (i, NMethodPropID::kInStreams, &propVariant) != S_OK)
        continue;
      if (propVariant.vt == VT_EMPTY)
        info.NumInStreams = 1;
      else if (propVariant.vt == VT_UI4)
        info.NumInStreams = propVariant.ulVal;
      else
        continue;
      propVariant.Clear();
      
      if (getMethodProperty (i, NMethodPropID::kOutStreams, &propVariant) != S_OK)
        continue;
      if (propVariant.vt == VT_EMPTY)
        info.NumOutStreams = 1;
      else if (propVariant.vt == VT_UI4)
        info.NumOutStreams = propVariant.ulVal;
      else
        continue;
      propVariant.Clear();
      
      g_Methods.Add(info);
    }
  }
}

static NSynchronization::CCriticalSection g_CriticalSection;

void LoadMethodMap()
{
  NSynchronization::CCriticalSectionLock lock(g_CriticalSection);
  if (g_Loaded)
    return;
  g_Loaded = true;
  Load(GetCodecsFolderPrefix());
}

bool GetMethodInfo(const CMethodID &methodID, CMethodInfo &methodInfo)
{
  for(int i = 0; i < g_Methods.Size(); i++)
  {
    const CMethodInfo2 &method = g_Methods[i];
    if (method.MethodID == methodID)
    {
      methodInfo = (CMethodInfo)method;
      return true;
    }
  }
  return false;
}

bool GetMethodInfo(const UString &name, CMethodInfo2 &methodInfo)
{
  for(int i = 0; i < g_Methods.Size(); i++)
  {
    const CMethodInfo2 &method = g_Methods[i];
    if (method.Name.CompareNoCase(name) == 0)
    {
      methodInfo = method;
      return true;
    }
  }
  return false;
}

}}


