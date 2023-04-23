// Common/Buffer.h

#ifndef __COMMON_BUFFER_H
#define __COMMON_BUFFER_H

#include "Defs.h"

template <class T> class CBuffer
{    
protected:
	size_t _capacity;
  T *_items;
  void Free()
  {
    delete []_items;
    _items = 0;
    _capacity = 0;
  }
public:
  CBuffer(): _capacity(0), _items(0) {};
  CBuffer(const CBuffer &buffer): _capacity(0), _items(0) { *this = buffer; }
  CBuffer(size_t size): _items(0),  _capacity(0) {  SetCapacity(size); }
  virtual ~CBuffer() { delete []_items; }
  operator T *() { return _items; };
  operator const T *() const { return _items; };
  size_t GetCapacity() const { return  _capacity; }
  void SetCapacity(size_t newCapacity)
  {
    if (newCapacity == _capacity)
      return;
    T *newBuffer;
    if (newCapacity > 0)
    {
      newBuffer = new T[newCapacity];
      if(_capacity > 0)
        memmove(newBuffer, _items, MyMin(_capacity, newCapacity) * sizeof(T));
    }
    else
      newBuffer = 0;
    delete []_items;
    _items = newBuffer;
    _capacity = newCapacity;
  }
  CBuffer& operator=(const CBuffer &buffer)
  {
    Free();
    if(buffer._capacity > 0)
    {
      SetCapacity(buffer._capacity);
      memmove(_items, buffer._items, buffer._capacity * sizeof(T));
    }
    return *this;
  }
};

template <class T>
bool operator==(const CBuffer<T>& b1, const CBuffer<T>& b2)
{
  if (b1.GetCapacity() != b2.GetCapacity())
    return false;
  for (size_t i = 0; i < b1.GetCapacity(); i++)
    if (b1[i] != b2[i])
      return false;
  return true;
}

template <class T>
bool operator!=(const CBuffer<T>& b1, const CBuffer<T>& b2)
{
  return !(b1 == b2);
}

typedef CBuffer<char> CCharBuffer;
typedef CBuffer<wchar_t> CWCharBuffer;
typedef CBuffer<unsigned char> CByteBuffer;

#endif
