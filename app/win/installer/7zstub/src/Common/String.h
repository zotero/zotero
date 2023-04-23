// Common/String.h

#ifndef __COMMON_STRING_H
#define __COMMON_STRING_H

#include <string.h>
// #include <wchar.h>

#include "Vector.h"

#ifdef _WIN32
#include "MyWindows.h"
#endif

static const char *kTrimDefaultCharSet  = " \n\t";

template <class T>
inline int MyStringLen(const T *s)
{ 
  int i;
  for (i = 0; s[i] != '\0'; i++);
  return i;
}

template <class T>
inline T * MyStringCopy(T *dest, const T *src)
{ 
  T *destStart = dest;
  while((*dest++ = *src++) != 0);
  return destStart;
}

inline wchar_t* MyStringGetNextCharPointer(wchar_t *p)
  { return (p + 1); }
inline const wchar_t* MyStringGetNextCharPointer(const wchar_t *p)
  { return (p + 1); }
inline wchar_t* MyStringGetPrevCharPointer(const wchar_t *, wchar_t *p)
  { return (p - 1); }
inline const wchar_t* MyStringGetPrevCharPointer(const wchar_t *, const wchar_t *p)
  { return (p - 1); }

#ifdef _WIN32

inline char* MyStringGetNextCharPointer(char *p)
  { return CharNextA(p); }
inline const char* MyStringGetNextCharPointer(const char *p)
  { return CharNextA(p); }

inline char* MyStringGetPrevCharPointer(char *base, char *p)
  { return CharPrevA(base, p); }
inline const char* MyStringGetPrevCharPointer(const char *base, const char *p)
  { return CharPrevA(base, p); }

inline char MyCharUpper(char c)
  { return (char)(unsigned int)CharUpperA((LPSTR)(unsigned int)(unsigned char)c); }
#ifdef _UNICODE
inline wchar_t MyCharUpper(wchar_t c)
  { return (wchar_t)CharUpperW((LPWSTR)c); }
#else
wchar_t MyCharUpper(wchar_t c);
#endif

inline char MyCharLower(char c)
  { return (char)(unsigned int)CharLowerA((LPSTR)(unsigned int)(unsigned char)c); }
#ifdef _UNICODE
inline wchar_t MyCharLower(wchar_t c)
  { return (wchar_t)CharLowerW((LPWSTR)c); }
#else
wchar_t MyCharLower(wchar_t c);
#endif

inline char * MyStringUpper(char *s) { return CharUpperA(s); }
#ifdef _UNICODE
inline wchar_t * MyStringUpper(wchar_t *s) { return CharUpperW(s); }
#else
wchar_t * MyStringUpper(wchar_t *s);
#endif

inline char * MyStringLower(char *s) { return CharLowerA(s); }
#ifdef _UNICODE
inline wchar_t * MyStringLower(wchar_t *s) { return CharLowerW(s); }
#else
wchar_t * MyStringLower(wchar_t *s);
#endif

#else // Standard-C
wchar_t MyCharUpper(wchar_t c);
#endif

//////////////////////////////////////
// Compare

/*
#ifndef _WIN32_WCE
int MyStringCollate(const char *s1, const char *s2);
int MyStringCollateNoCase(const char *s1, const char *s2);
#endif
int MyStringCollate(const wchar_t *s1, const wchar_t *s2);
int MyStringCollateNoCase(const wchar_t *s1, const wchar_t *s2);
*/

int MyStringCompare(const char *s1, const char  *s2);
int MyStringCompare(const wchar_t *s1, const wchar_t *s2);

#ifdef _WIN32
int MyStringCompareNoCase(const char *s1, const char  *s2);
#endif

int MyStringCompareNoCase(const wchar_t *s1, const wchar_t *s2);

template <class T>
class CStringBase
{
  void TrimLeftWithCharSet(const CStringBase &charSet)
  {
    const T *p = _chars;
    while (charSet.Find(*p) >= 0 && (*p != 0))
      p = GetNextCharPointer(p);
    Delete(0, (int)(p - _chars));
  }
  void TrimRightWithCharSet(const CStringBase &charSet)
  {
    const T *p = _chars;
    const T *pLast = NULL;
    while (*p != 0)
    {
      if (charSet.Find(*p) >= 0)
      {
        if (pLast == NULL)
          pLast = p;
      }
      else
        pLast = NULL;
      p = GetNextCharPointer(p);
    }
    if(pLast != NULL)
    {
      int i = (int)(pLast - _chars);
      Delete(i, _length - i);
    }

  }
  void MoveItems(int destIndex, int srcIndex)
  {
    memmove(_chars + destIndex, _chars + srcIndex, 
        sizeof(T) * (_length - srcIndex + 1));
  }
  
  void InsertSpace(int &index, int size)
  {
    CorrectIndex(index);
    GrowLength(size);
    MoveItems(index + size, index);
  }

  static T *GetNextCharPointer(T *p)
    { return MyStringGetNextCharPointer(p); }
  static const T *GetNextCharPointer(const T *p)
    { return MyStringGetNextCharPointer(p); }
  static T *GetPrevCharPointer(T *base, T *p)
    { return MyStringGetPrevCharPointer(base, p); }
  static const T *GetPrevCharPointer(const T *base, const T *p)
    { return MyStringGetPrevCharPointer(base, p); }
protected:
  T *_chars;
  int _length;
	int _capacity;
  
  void SetCapacity(int newCapacity)
  {
    int realCapacity = newCapacity + 1;
    if(realCapacity == _capacity)
      return;
    /*
    const int kMaxStringSize = 0x20000000;
    #ifndef _WIN32_WCE
    if(newCapacity > kMaxStringSize || newCapacity < _length)
      throw 1052337;
    #endif
    */
    T *newBuffer = new T[realCapacity];
    if(_capacity > 0)
    {
      for (int i = 0; i < (_length + 1); i++)
        newBuffer[i] = _chars[i];
      delete []_chars;
      _chars = newBuffer;
    }
    else
    {
      _chars = newBuffer;
      _chars[0] = 0;
    }
    _capacity = realCapacity;
  }

  void GrowLength(int n)
  {
    int freeSize = _capacity - _length - 1;
    if (n <= freeSize) 
      return;
    int delta;
    if (_capacity > 64)
      delta = _capacity / 2;
    else if (_capacity > 8)
      delta = 16;
    else
      delta = 4;
    if (freeSize + delta < n)
      delta = n - freeSize;
    SetCapacity(_capacity + delta);
  }

  void CorrectIndex(int &index) const
  {
    if (index > _length)
      index = _length;
  }

public:
  CStringBase(): _chars(0), _length(0), _capacity(0)
    { SetCapacity(16 - 1); }
  CStringBase(T c):  _chars(0), _length(0), _capacity(0)
  {
    SetCapacity(1);
    _chars[0] = c;
    _chars[1] = 0;
    _length = 1;
  }
  CStringBase(const T *chars): _chars(0), _length(0), _capacity(0)
  {
    int length = MyStringLen(chars);
    SetCapacity(length);
    MyStringCopy(_chars, chars); // can be optimized by memove()
    _length = length;
  }
  CStringBase(const CStringBase &s):  _chars(0), _length(0), _capacity(0)
  {
    SetCapacity(s._length);
    MyStringCopy(_chars, s._chars);
    _length = s._length;
  }
  ~CStringBase() {  delete []_chars; }

  operator const T*() const { return _chars;} 

  // The minimum size of the character buffer in characters. 
  // This value does not include space for a null terminator.
  T* GetBuffer(int minBufLength)
  {
    if(minBufLength >= _capacity)
      SetCapacity(minBufLength + 1);
    return _chars;
  }
  void ReleaseBuffer() { ReleaseBuffer(MyStringLen(_chars)); }
  void ReleaseBuffer(int newLength)
  {
    /*
    #ifndef _WIN32_WCE
    if(newLength >= _capacity)
      throw 282217;
    #endif
    */
    _chars[newLength] = 0;
    _length = newLength;
  }

  CStringBase& operator=(T c)
  {
    Empty();
    SetCapacity(1);
    _chars[0] = c;
    _chars[1] = 0;
    _length = 1;
    return *this;
  }
  CStringBase& operator=(const T *chars)
  {
    Empty();
    int length = MyStringLen(chars);
    SetCapacity(length);
    MyStringCopy(_chars, chars);
    _length = length; 
    return *this;
  }  
  CStringBase& operator=(const CStringBase& s)
  {
    if(&s == this)
      return *this;
    Empty();
    SetCapacity(s._length);
    MyStringCopy(_chars, s._chars);
    _length = s._length;
    return *this;
  }
  
  CStringBase& operator+=(T c)
  {
    GrowLength(1);
    _chars[_length] = c;
    _chars[++_length] = 0;
    return *this;
  }
  CStringBase& operator+=(const T *s)
  {
    int len = MyStringLen(s);
    GrowLength(len);
    MyStringCopy(_chars + _length, s);
    _length += len;
    return *this;
  }
  CStringBase& operator+=(const CStringBase &s)
  {
    GrowLength(s._length);
    MyStringCopy(_chars + _length, s._chars);
    _length += s._length;
    return *this;
  }
  void Empty()
  {
    _length = 0;
    _chars[0] = 0;
  }
  int Length() const { return _length; }
  bool IsEmpty() const { return (_length == 0); }

  CStringBase Mid(int startIndex) const
    { return Mid(startIndex, _length - startIndex); }
  CStringBase Mid(int startIndex, int count ) const
  {
    if (startIndex + count > _length)
      count = _length - startIndex;
    
    if (startIndex == 0 && startIndex + count == _length)
      return *this;
    
    CStringBase<T> result;
    result.SetCapacity(count);
    // MyStringNCopy(result._chars, _chars + startIndex, count);
    for (int i = 0; i < count; i++)
      result._chars[i] = _chars[startIndex + i];
    result._chars[count] = 0;
    result._length = count;
    return result;
  }
  CStringBase Left(int count) const
    { return Mid(0, count); }
  CStringBase Right(int count) const
  {
    if (count > _length)
      count = _length;
    return Mid(_length - count, count);
  }

  void MakeUpper()
    { MyStringUpper(_chars); }
  void MakeLower()
    { MyStringLower(_chars); }

  int Compare(const CStringBase& s) const
    { return MyStringCompare(_chars, s._chars); }

  int CompareNoCase(const CStringBase& s) const
    { return MyStringCompareNoCase(_chars, s._chars); }
  /*
  int Collate(const CStringBase& s) const
    { return MyStringCollate(_chars, s._chars); }
  int CollateNoCase(const CStringBase& s) const
    { return MyStringCollateNoCase(_chars, s._chars); }
  */

  int Find(T c) const { return Find(c, 0); }
  int Find(T c, int startIndex) const
  {
    T *p = _chars + startIndex;
    while (true)
    {
      if (*p == c)
        return (int)(p - _chars);
      if (*p == 0)
        return -1;
      p = GetNextCharPointer(p);
    }
  }
  int Find(const CStringBase &s) const { return Find(s, 0); }
  int Find(const CStringBase &s, int startIndex) const
  {
    if (s.IsEmpty())
      return startIndex;
    for (; startIndex < _length; startIndex++)
    {
      int j;
      for (j = 0; j < s._length && startIndex + j < _length; j++)
        if (_chars[startIndex+j] != s._chars[j])
          break;
      if (j == s._length)
        return startIndex;
    }
    return -1;
  }
  int ReverseFind(T c) const
  {
    if (_length == 0)
      return -1;
    T *p = _chars + _length - 1;
    while (true)
    {
      if (*p == c)
        return (int)(p - _chars);
      if (p == _chars)
        return -1;
      p = GetPrevCharPointer(_chars, p);
    }
  }
  int FindOneOf(const CStringBase &s) const
  {
    for(int i = 0; i < _length; i++)
      if (s.Find(_chars[i]) >= 0)
        return i;
      return -1;
  }

  void TrimLeft(T c)
  {
    const T *p = _chars;
    while (c == *p)
      p = GetNextCharPointer(p);
    Delete(0, p - _chars);
  }
  private:
  CStringBase GetTrimDefaultCharSet()
  {
    CStringBase<T> charSet;
    for(int i = 0; i < (int)(sizeof(kTrimDefaultCharSet) /
      sizeof(kTrimDefaultCharSet[0])); i++)
      charSet += (T)kTrimDefaultCharSet[i];
    return charSet;
  }
  public:

  void TrimLeft()
  {
    TrimLeftWithCharSet(GetTrimDefaultCharSet());
  }
  void TrimRight()
  {
    TrimRightWithCharSet(GetTrimDefaultCharSet());
  }
  void TrimRight(T c)
  {
    const T *p = _chars;
    const T *pLast = NULL;
    while (*p != 0)
    {
      if (*p == c)
      {
        if (pLast == NULL)
          pLast = p;
      }
      else
        pLast = NULL;
      p = GetNextCharPointer(p);
    }
    if(pLast != NULL)
    {
      int i = pLast - _chars;
      Delete(i, _length - i);
    }
  }
  void Trim()
  {
    TrimRight();
    TrimLeft();
  }

  int Insert(int index, T c)
  {
    InsertSpace(index, 1);
    _chars[index] = c;
    _length++;
    return _length;
  }
  int Insert(int index, const CStringBase &s)
  {
    CorrectIndex(index);
    if (s.IsEmpty())
      return _length;
    int numInsertChars = s.Length();
    InsertSpace(index, numInsertChars);
    for(int i = 0; i < numInsertChars; i++)
      _chars[index + i] = s[i];
    _length += numInsertChars;
    return _length;
  }

  // !!!!!!!!!!!!!!! test it if newChar = '\0'
  int Replace(T oldChar, T newChar)
  {
    if (oldChar == newChar)
      return 0;
    int number  = 0;
    int pos  = 0;
    while (pos < Length())
    {
      pos = Find(oldChar, pos);
      if (pos < 0) 
        break;
      _chars[pos] = newChar;
      pos++;
      number++;
    }
    return number;
  }
  int Replace(const CStringBase &oldString, const CStringBase &newString)
  {
    if (oldString.IsEmpty())
      return 0;
    if (oldString == newString)
      return 0;
    int oldStringLength = oldString.Length();
    int newStringLength = newString.Length();
    int number  = 0;
    int pos  = 0;
    while (pos < _length)
    {
      pos = Find(oldString, pos);
      if (pos < 0) 
        break;
      Delete(pos, oldStringLength);
      Insert(pos, newString);
      pos += newStringLength;
      number++;
    }
    return number;
  }
  int Delete(int index, int count = 1 )
  {
    if (index + count > _length)
      count = _length - index;
    if (count > 0)
    {
      MoveItems(index, index + count);
      _length -= count;
    }
    return _length;
  }
};

template <class T>
CStringBase<T> operator+(const CStringBase<T>& s1, const CStringBase<T>& s2)
{
  CStringBase<T> result(s1);
  result += s2;
  return result; 
}

template <class T>
CStringBase<T> operator+(const CStringBase<T>& s, T c)
{
  CStringBase<T> result(s);
  result += c;
  return result; 
}

template <class T>
CStringBase<T> operator+(T c, const CStringBase<T>& s)
{
  CStringBase<T> result(c);
  result += s;
  return result; 
}

template <class T>
CStringBase<T> operator+(const CStringBase<T>& s, const T * chars)
{
  CStringBase<T> result(s);
  result += chars;
  return result; 
}

template <class T>
CStringBase<T> operator+(const T * chars, const CStringBase<T>& s)
{
  CStringBase<T> result(chars);
  result += s;
  return result; 
}

template <class T>
bool operator==(const CStringBase<T>& s1, const CStringBase<T>& s2)
  { return (s1.Compare(s2) == 0); }

template <class T>
bool operator<(const CStringBase<T>& s1, const CStringBase<T>& s2)
  { return (s1.Compare(s2) < 0); }

template <class T>
bool operator==(const T *s1, const CStringBase<T>& s2)
  { return (s2.Compare(s1) == 0); }

template <class T>
bool operator==(const CStringBase<T>& s1, const T *s2)
  { return (s1.Compare(s2) == 0); }

template <class T>
bool operator!=(const CStringBase<T>& s1, const CStringBase<T>& s2)
  { return (s1.Compare(s2) != 0); }

template <class T>
bool operator!=(const T *s1, const CStringBase<T>& s2)
  { return (s2.Compare(s1) != 0); }

template <class T>
bool operator!=(const CStringBase<T>& s1, const T *s2)
  { return (s1.Compare(s2) != 0); }

typedef CStringBase<char> AString;
typedef CStringBase<wchar_t> UString;

typedef CObjectVector<AString> AStringVector;
typedef CObjectVector<UString> UStringVector;

#ifdef _UNICODE
  typedef UString CSysString;
#else
  typedef AString CSysString;
#endif

typedef CObjectVector<CSysString> CSysStringVector;

#endif
