// StreamUtils.h

#ifndef __STREAMUTILS_H
#define __STREAMUTILS_H

#include "../IStream.h"

HRESULT ReadStream(ISequentialInStream *stream, void *data, UInt32 size, UInt32 *processedSize);
HRESULT WriteStream(ISequentialOutStream *stream, const void *data, UInt32 size, UInt32 *processedSize);

#endif
