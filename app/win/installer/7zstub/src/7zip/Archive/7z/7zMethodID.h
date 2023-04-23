// 7zMethodID.h

#ifndef __7Z_METHOD_ID_H
#define __7Z_METHOD_ID_H

#include "../../../Common/String.h"
#include "../../../Common/Types.h"

namespace NArchive {
namespace N7z {

const int kMethodIDSize = 15;
  
struct CMethodID
{
  Byte ID[kMethodIDSize];
  Byte IDSize;
  UString ConvertToString() const;
  bool ConvertFromString(const UString &srcString);
};

bool operator==(const CMethodID &a1, const CMethodID &a2);

inline bool operator!=(const CMethodID &a1, const CMethodID &a2)
  { return !(a1 == a2); }

}}

#endif
