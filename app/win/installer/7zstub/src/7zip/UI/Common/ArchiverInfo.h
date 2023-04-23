// ArchiverInfo.h

#ifndef __ARCHIVERINFO_H
#define __ARCHIVERINFO_H

#include "Common/String.h"
#include "Common/Types.h"
#include "Common/Buffer.h"

struct CArchiverExtInfo
{
  UString Ext;
  UString AddExt;
  CArchiverExtInfo() {}
  CArchiverExtInfo(const UString &ext): Ext(ext) {}
  CArchiverExtInfo(const UString &ext, const UString &addExt): Ext(ext), AddExt(addExt) {}
};

struct CArchiverInfo
{
  #ifndef EXCLUDE_COM
  UString FilePath;
  CLSID ClassID;
  #endif
  UString Name;
  CObjectVector<CArchiverExtInfo> Extensions;
  #ifndef _SFX
  CByteBuffer StartSignature;
  CByteBuffer FinishSignature;
  bool Associate;
  #endif
  int FindExtension(const UString &ext) const
  {
    for (int i = 0; i < Extensions.Size(); i++)
      if (ext.CompareNoCase(Extensions[i].Ext) == 0)
        return i;
    return -1;
  }
  UString GetAllExtensions() const
  {
    UString s;
    for (int i = 0; i < Extensions.Size(); i++)
    {
      if (i > 0)
        s += ' ';
      s += Extensions[i].Ext;
    }
    return s;
  }
  const UString &GetMainExtension() const 
  { 
    return Extensions[0].Ext;
  }
  bool UpdateEnabled;
  bool KeepName;

  CArchiverInfo(): UpdateEnabled(false), KeepName(false)
  #ifndef _SFX
  ,Associate(true)
  #endif
  {}
};

void ReadArchiverInfoList(CObjectVector<CArchiverInfo> &archivers);

#endif
