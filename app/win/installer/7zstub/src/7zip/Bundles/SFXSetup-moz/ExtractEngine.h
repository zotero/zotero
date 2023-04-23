// ExtractEngine.h

#ifndef __EXTRACTENGINE_H
#define __EXTRACTENGINE_H

#include "Common/String.h"
#include "../../UI/GUI/OpenCallbackGUI.h"

HRESULT ExtractArchive(
    const UString &fileName, 
    const UString &folderName,
    COpenCallbackGUI *openCallback,
    bool showProgress,
    bool &isCorrupt, 
    UString &errorMessage);

#endif
