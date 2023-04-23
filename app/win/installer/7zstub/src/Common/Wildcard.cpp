// Common/Wildcard.cpp

#include "StdAfx.h"

#include "Wildcard.h"

static const wchar_t kPeriodChar = L'.';
static const wchar_t kAnyCharsChar = L'*';
static const wchar_t kAnyCharChar = L'?';

#ifdef _WIN32
static const wchar_t kDirDelimiter1 = L'\\';
#endif
static const wchar_t kDirDelimiter2 = L'/';

static const UString kWildCardCharSet = L"?*";

static const UString kIllegalWildCardFileNameChars=
  L"\x1\x2\x3\x4\x5\x6\x7\x8\x9\xA\xB\xC\xD\xE\xF"
  L"\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1A\x1B\x1C\x1D\x1E\x1F"
  L"\"/:<>\\|";

static const UString kIllegalFileNameChars = kIllegalWildCardFileNameChars + 
    kWildCardCharSet;

static inline bool IsCharDirLimiter(wchar_t c)
{
  return (
    #ifdef _WIN32
    c == kDirDelimiter1 || 
    #endif
    c == kDirDelimiter2);
}

// -----------------------------------------
// this function tests is name matches mask
// ? - any wchar_t or empty
// * - any characters or empty

static bool EnhancedMaskTest(const UString &mask, int maskPos, 
    const UString &name, int namePos)
{
  int maskLen = mask.Length() - maskPos;
  int nameLen = name.Length() - namePos;
  if (maskLen == 0) 
    if (nameLen == 0)
      return true;
    else
      return false;
  wchar_t maskChar = mask[maskPos];
  if(maskChar == kAnyCharChar)
  {
    /*
    if (EnhancedMaskTest(mask, maskPos + 1, name, namePos))
      return true;
    */
    if (nameLen == 0) 
      return false;
    return EnhancedMaskTest(mask,  maskPos + 1, name, namePos + 1);
  }
  else if(maskChar == kAnyCharsChar)
  {
    if (EnhancedMaskTest(mask, maskPos + 1, name, namePos))
      return true;
    if (nameLen == 0) 
      return false;
    return EnhancedMaskTest(mask, maskPos, name, namePos + 1);
  }
  else
  {
    wchar_t c = name[namePos];
    if (maskChar != c)
#ifdef _WIN32
      if (MyCharUpper(maskChar) != MyCharUpper(c))
#endif
        return false;
    return EnhancedMaskTest(mask,  maskPos + 1, name, namePos + 1);
  }
}

// --------------------------------------------------
// Splits path to strings

void SplitPathToParts(const UString &path, UStringVector &pathParts)
{
  pathParts.Clear();
  UString name;
  int len = path.Length();
  if (len == 0)
    return;
  for (int i = 0; i < len; i++)
  {
    wchar_t c = path[i];
    if (IsCharDirLimiter(c))
    {
      pathParts.Add(name);
      name.Empty();
    }
    else
      name += c;
  }
  pathParts.Add(name);
}

void SplitPathToParts(const UString &path, UString &dirPrefix, UString &name)
{
  int i;
  for(i = path.Length() - 1; i >= 0; i--)
    if(IsCharDirLimiter(path[i]))
      break;
  dirPrefix = path.Left(i + 1);
  name = path.Mid(i + 1);
}

UString ExtractDirPrefixFromPath(const UString &path)
{
  int i;
  for(i = path.Length() - 1; i >= 0; i--)
    if(IsCharDirLimiter(path[i]))
      break;
  return path.Left(i + 1);
}

UString ExtractFileNameFromPath(const UString &path)
{
  int i;
  for(i = path.Length() - 1; i >= 0; i--)
    if(IsCharDirLimiter(path[i]))
      break;
  return path.Mid(i + 1);
}


bool CompareWildCardWithName(const UString &mask, const UString &name)
{
  return EnhancedMaskTest(mask, 0, name, 0);
}

bool DoesNameContainWildCard(const UString &path)
{
  return (path.FindOneOf(kWildCardCharSet) >= 0);
}


// ----------------------------------------------------------'
// NWildcard

namespace NWildcard {

static inline int BoolToIndex(bool value)
{
  return value ? 1: 0;
}


/*
M = MaskParts.Size();
N = TestNameParts.Size();

                           File                          Dir
ForFile     req   M<=N  [N-M, N)                          -
         nonreq   M=N   [0, M)                            -  
 
ForDir      req   M<N   [0, M) ... [N-M-1, N-1)  same as ForBoth-File
         nonreq         [0, M)                   same as ForBoth-File

ForBoth     req   m<=N  [0, M) ... [N-M, N)      same as ForBoth-File
         nonreq         [0, M)                   same as ForBoth-File

*/

bool CItem::CheckPath(const UStringVector &pathParts, bool isFile) const
{
  if (!isFile && !ForDir)
    return false;
  int delta = (int)pathParts.Size() - (int)PathParts.Size();
  if (delta < 0)
    return false;
  int start = 0;
  int finish = 0;
  if (isFile)
  {
    if (!ForDir && !Recursive && delta !=0)
      return false;
    if (!ForFile && delta == 0)
      return false;
    if (!ForDir && Recursive)
      start = delta;
  }
  if (Recursive)
  {
    finish = delta;
    if (isFile && !ForFile)
      finish = delta - 1;
  }
  for (int d = start; d <= finish; d++)
  {
    int i;
    for (i = 0; i < PathParts.Size(); i++)
      if (!CompareWildCardWithName(PathParts[i], pathParts[i + d]))
        break;
    if (i == PathParts.Size())
      return true;
  }
  return false;
}

int CCensorNode::FindSubNode(const UString &name) const
{
  for (int i = 0; i < SubNodes.Size(); i++)
    if (SubNodes[i].Name.CompareNoCase(name) == 0)
      return i;
  return -1;
}

void CCensorNode::AddItemSimple(bool include, CItem &item)
{
  if (include)
    IncludeItems.Add(item);
  else
    ExcludeItems.Add(item);
}

void CCensorNode::AddItem(bool include, CItem &item)
{
  if (item.PathParts.Size() <= 1)
  {
    AddItemSimple(include, item);
    return;
  }
  const UString &front = item.PathParts.Front();
  if (DoesNameContainWildCard(front))
  {
    AddItemSimple(include, item);
    return;
  }
  int index = FindSubNode(front);
  if (index < 0)
    index = SubNodes.Add(CCensorNode(front, this));
  item.PathParts.Delete(0);
  SubNodes[index].AddItem(include, item);
}

void CCensorNode::AddItem(bool include, const UString &path, bool recursive, bool forFile, bool forDir)
{
  CItem item;
  SplitPathToParts(path, item.PathParts);
  item.Recursive = recursive;
  item.ForFile = forFile;
  item.ForDir = forDir;
  AddItem(include, item);
}

bool CCensorNode::NeedCheckSubDirs() const
{
  for (int i = 0; i < IncludeItems.Size(); i++)
  {
    const CItem &item = IncludeItems[i];
    if (item.Recursive || item.PathParts.Size() > 1)
      return true;
  }
  return false;
}

bool CCensorNode::AreThereIncludeItems() const
{
  if (IncludeItems.Size() > 0)
    return true;
  for (int i = 0; i < SubNodes.Size(); i++)
    if (SubNodes[i].AreThereIncludeItems())
      return true;
  return false;
}

bool CCensorNode::CheckPathCurrent(bool include, const UStringVector &pathParts, bool isFile) const
{
  const CObjectVector<CItem> &items = include ? IncludeItems : ExcludeItems;
  for (int i = 0; i < items.Size(); i++)
    if (items[i].CheckPath(pathParts, isFile))
      return true;
  return false;
}

bool CCensorNode::CheckPath(UStringVector &pathParts, bool isFile, bool &include) const
{
  if (CheckPathCurrent(false, pathParts, isFile))
  {
    include = false;
    return true;
  }
  include = true;
  bool finded = CheckPathCurrent(true, pathParts, isFile);
  if (pathParts.Size() == 1)
    return finded;
  int index = FindSubNode(pathParts.Front());
  if (index >= 0)
  {
    UStringVector pathParts2 = pathParts;
    pathParts2.Delete(0);
    if (SubNodes[index].CheckPath(pathParts2, isFile, include))
      return true;
  }
  return finded;
}

bool CCensorNode::CheckPath(const UString &path, bool isFile, bool &include) const
{
  UStringVector pathParts; 
  SplitPathToParts(path, pathParts);
  return CheckPath(pathParts, isFile, include);
}

bool CCensorNode::CheckPath(const UString &path, bool isFile) const
{
  bool include;
  if(CheckPath(path, isFile, include))
    return include;
  return false;
}

bool CCensorNode::CheckPathToRoot(bool include, UStringVector &pathParts, bool isFile) const
{
  if (CheckPathCurrent(include, pathParts, isFile))
    return true;
  if (Parent == 0)
    return false;
  pathParts.Insert(0, Name);
  return Parent->CheckPathToRoot(include, pathParts, isFile);
}

/*
bool CCensorNode::CheckPathToRoot(bool include, const UString &path, bool isFile) const
{
  UStringVector pathParts; 
  SplitPathToParts(path, pathParts);
  return CheckPathToRoot(include, pathParts, isFile);
}
*/

void CCensorNode::AddItem2(bool include, const UString &path, bool recursive)
{
  if (path.IsEmpty())
    return;
  bool forFile = true;
  bool forFolder = true;
  UString path2 = path;
  if (IsCharDirLimiter(path[path.Length() - 1]))
  {
    path2.Delete(path.Length() - 1);
    forFile = false;
  }
  AddItem(include, path2, recursive, forFile, forFolder);
}

void CCensorNode::ExtendExclude(const CCensorNode &fromNodes)
{
  ExcludeItems += fromNodes.ExcludeItems;
  for (int i = 0; i < fromNodes.SubNodes.Size(); i++)
  {
    const CCensorNode &node = fromNodes.SubNodes[i];
    int subNodeIndex = FindSubNode(node.Name);
    if (subNodeIndex < 0)
      subNodeIndex = SubNodes.Add(CCensorNode(node.Name, this));
    SubNodes[subNodeIndex].ExtendExclude(node);
  }
}

int CCensor::FindPrefix(const UString &prefix) const
{
  for (int i = 0; i < Pairs.Size(); i++)
    if (Pairs[i].Prefix.CompareNoCase(prefix) == 0)
      return i;
  return -1;
}

void CCensor::AddItem(bool include, const UString &path, bool recursive)
{
  UStringVector pathParts;
  SplitPathToParts(path, pathParts);
  bool forFile = true;
  if (pathParts.Back().IsEmpty())
  {
    forFile = false;
    pathParts.DeleteBack();
  }
  const UString &front = pathParts.Front();
  bool isAbs = false;
  if (front.IsEmpty())
    isAbs = true;
  else if (front.Length() == 2 && front[1] == L':')
    isAbs = true;
  else
  {
    for (int i = 0; i < pathParts.Size(); i++)
    {
      const UString &part = pathParts[i];
      if (part == L".." || part == L".")
      {
        isAbs = true;
        break;
      }
    }
  }
  int numAbsParts = 0;
  if (isAbs)
    if (pathParts.Size() > 1)
      numAbsParts = pathParts.Size() - 1;
    else
      numAbsParts = 1;
  UString prefix;
  for (int i = 0; i < numAbsParts; i++)
  {
    const UString &front = pathParts.Front();
    if (DoesNameContainWildCard(front))
      break;
    prefix += front;
    prefix += WCHAR_PATH_SEPARATOR;
    pathParts.Delete(0);
  }
  int index = FindPrefix(prefix);
  if (index < 0)
    index = Pairs.Add(CPair(prefix));

  CItem item;
  item.PathParts = pathParts;
  item.ForDir = true;
  item.ForFile = forFile;
  item.Recursive = recursive;
  Pairs[index].Head.AddItem(include, item);
}

bool CCensor::CheckPath(const UString &path, bool isFile) const
{
  bool finded = false;
  for (int i = 0; i < Pairs.Size(); i++)
  {
    bool include;
    if (Pairs[i].Head.CheckPath(path, isFile, include))
    {
      if (!include)
        return false;
      finded = true;
    }
  }
  return finded;
}

void CCensor::ExtendExclude()
{
  int i;
  for (i = 0; i < Pairs.Size(); i++)
    if (Pairs[i].Prefix.IsEmpty())
      break;
  if (i == Pairs.Size())
    return;
  int index = i;
  for (i = 0; i < Pairs.Size(); i++)
    if (index != i)
      Pairs[i].Head.ExtendExclude(Pairs[index].Head);
}

}
