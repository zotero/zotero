# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.


# NOTE: For English locales, strings in this file should be in APA-style Title Case.
# See https://apastyle.apa.org/style-grammar-guidelines/capitalization/title-case
#
# NOTE: For Engineers, please don't re-use these strings outside of the menubar.


## Application Menu (macOS only)

menu-application-preferences =
    .label = 설정
menu-application-services =
    .label = 서비스
menu-application-hide-this =
    .label = { -brand-shorter-name } 숨기기
menu-application-hide-other =
    .label = 모두 숨기기
menu-application-show-all =
    .label = 모두 표시
menu-application-touch-bar =
    .label = 터치바 사용자 정의…

##

# These menu-quit strings are only used on Windows and Linux.
menu-quit =
    .label =
        { PLATFORM() ->
            [windows] 종료
           *[other] 종료
        }
    .accesskey =
        { PLATFORM() ->
            [windows] x
           *[other] Q
        }
# This menu-quit-mac string is only used on macOS.
menu-quit-mac =
    .label = { -brand-shorter-name } 종료
menu-about =
    .label = { -brand-shorter-name } 정보
    .accesskey = A

## File Menu

menu-file =
    .label = 파일
    .accesskey = F
menu-file-new-tab =
    .label = 새 탭
    .accesskey = T
menu-file-new-container-tab =
    .label = 새 컨테이너 탭
    .accesskey = C
menu-file-new-window =
    .label = 새 창
    .accesskey = N
menu-file-new-private-window =
    .label = 새 사생활 보호 창
    .accesskey = W
# "Open Location" is only displayed on macOS, and only on windows
# that aren't main browser windows, or when there are no windows
# but Firefox is still running.
menu-file-open-location =
    .label = 주소 열기…
menu-file-open-file =
    .label = 파일 열기…
    .accesskey = O
# Variables:
#  $tabCount (Number): the number of tabs that are affected by the action.
menu-file-close-tab =
    .label =
        { $tabCount ->
            [1] 탭 닫기
           *[other] 탭 { $tabCount }개 닫기
        }
    .accesskey = C
menu-file-close-window =
    .label = 창 닫기
    .accesskey = d
menu-file-save-page =
    .label = 페이지를 다른 이름으로 저장…
    .accesskey = A
menu-file-email-link =
    .label = 메일로 링크 보내기…
    .accesskey = E
menu-file-share-url =
    .label = 공유
    .accesskey = h
menu-file-print-setup =
    .label = 페이지 설정…
    .accesskey = u
menu-file-print =
    .label = 인쇄…
    .accesskey = P
menu-file-import-from-another-browser =
    .label = 다른 브라우저에서 가져오기…
    .accesskey = I
menu-file-go-offline =
    .label = 오프라인으로 작업
    .accesskey = w

## Edit Menu

menu-edit =
    .label = 편집
    .accesskey = E
menu-edit-find-in-page =
    .label = 페이지에서 찾기…
    .accesskey = F
menu-edit-find-again =
    .label = 다시 찾기
    .accesskey = g
menu-edit-bidi-switch-text-direction =
    .label = 글자 방향 변경
    .accesskey = w

## View Menu

menu-view =
    .label = 보기
    .accesskey = V
menu-view-toolbars-menu =
    .label = 도구 모음
    .accesskey = T
menu-view-customize-toolbar2 =
    .label = 도구 모음 사용자 지정…
    .accesskey = C
menu-view-sidebar =
    .label = 탐색창
    .accesskey = e
menu-view-bookmarks =
    .label = 북마크
menu-view-history-button =
    .label = 기록
menu-view-synced-tabs-sidebar =
    .label = 동기화된 탭
menu-view-full-zoom =
    .label = 확대/축소
    .accesskey = Z
menu-view-full-zoom-enlarge =
    .label = 확대
    .accesskey = I
menu-view-full-zoom-reduce =
    .label = 축소
    .accesskey = O
menu-view-full-zoom-actual-size =
    .label = 실제 크기
    .accesskey = A
menu-view-full-zoom-toggle =
    .label = 글자 크기만 조정
    .accesskey = T
menu-view-page-style-menu =
    .label = 문서 스타일
    .accesskey = y
menu-view-page-style-no-style =
    .label = 스타일 제거
    .accesskey = n
menu-view-page-basic-style =
    .label = 문서 지정 스타일
    .accesskey = b
menu-view-repair-text-encoding =
    .label = 텍스트 인코딩 복구
    .accesskey = c

## These should match what Safari and other Apple applications
## use on macOS.

menu-view-enter-full-screen =
    .label = 전체 화면으로 표시
    .accesskey = F
menu-view-exit-full-screen =
    .label = 전체 화면 종료
    .accesskey = F
menu-view-full-screen =
    .label = 전체 화면
    .accesskey = F

## These menu items may use the same accesskey.

# This should match reader-view-enter-button in browser.ftl
menu-view-enter-readerview =
    .label = 리더뷰 보기
    .accesskey = R
# This should match reader-view-close-button in browser.ftl
menu-view-close-readerview =
    .label = 리더뷰 닫기
    .accesskey = R

##

menu-view-show-all-tabs =
    .label = 모든 탭 표시
    .accesskey = A
menu-view-bidi-switch-page-direction =
    .label = 페이지 방향 변경
    .accesskey = g

## History Menu

menu-history =
    .label = 기록
    .accesskey = s
menu-history-show-all-history =
    .label = 모든 기록 보기
menu-history-clear-recent-history =
    .label = 최근 기록 지우기…
menu-history-synced-tabs =
    .label = 동기화된 탭
menu-history-restore-last-session =
    .label = 이전 세션 복원
menu-history-hidden-tabs =
    .label = 숨겨진 탭
menu-history-undo-menu =
    .label = 최근에 닫은 탭
menu-history-undo-window-menu =
    .label = 최근에 닫은 창
menu-history-reopen-all-tabs = 모든 탭 다시 열기
menu-history-reopen-all-windows = 모든 창 다시 열기

## Bookmarks Menu

menu-bookmarks-menu =
    .label = 북마크
    .accesskey = B
menu-bookmarks-manage =
    .label = 북마크 관리
menu-bookmark-current-tab =
    .label = 현재 탭 북마크
menu-bookmark-edit =
    .label = 이 북마크 편집
menu-bookmark-tab =
    .label = 현재 탭 북마크…
menu-edit-bookmark =
    .label = 이 북마크 편집…
menu-bookmarks-all-tabs =
    .label = 모든 탭 북마크…
menu-bookmarks-toolbar =
    .label = 북마크 도구 모음
menu-bookmarks-other =
    .label = 기타 북마크
menu-bookmarks-mobile =
    .label = 모바일 북마크

## Tools Menu

menu-tools =
    .label = 도구
    .accesskey = T
menu-tools-downloads =
    .label = 다운로드
    .accesskey = D
menu-tools-addons-and-themes =
    .label = 부가 기능 및 테마
    .accesskey = A
menu-tools-fxa-sign-in2 =
    .label = 로그인
    .accesskey = g
menu-tools-turn-on-sync2 =
    .label = Sync 켜기…
    .accesskey = n
menu-tools-sync-now =
    .label = 지금 동기화
    .accesskey = S
menu-tools-fxa-re-auth =
    .label = { -brand-product-name }에 다시 연결…
    .accesskey = R
menu-tools-browser-tools =
    .label = 브라우저 도구
    .accesskey = B
menu-tools-task-manager =
    .label = 작업 관리자
    .accesskey = M
menu-tools-page-source =
    .label = 페이지 소스
    .accesskey = o
menu-tools-page-info =
    .label = 페이지 정보
    .accesskey = I
menu-settings =
    .label = 설정
    .accesskey =
        { PLATFORM() ->
            [windows] S
           *[other] n
        }
menu-tools-layout-debugger =
    .label = 레이아웃 디버거
    .accesskey = L

## Window Menu

menu-window-menu =
    .label = 창
menu-window-bring-all-to-front =
    .label = 맨 앞으로

## Help Menu


# NOTE: For Engineers, any additions or changes to Help menu strings should
# also be reflected in the related strings in appmenu.ftl. Those strings, by
# convention, will have the same ID as these, but prefixed with "app".
# Example: appmenu-get-help
#
# These strings are duplicated to allow for different casing depending on
# where the strings appear.

menu-help =
    .label = 도움말
    .accesskey = H
menu-get-help =
    .label = 도움 받기
    .accesskey = H
menu-help-more-troubleshooting-info =
    .label = 추가 문제 해결 정보
    .accesskey = T
menu-help-report-site-issue =
    .label = 사이트 문제 보고…
menu-help-share-ideas =
    .label = 아이디어 공유 및 의견 보내기…
    .accesskey = S
menu-help-enter-troubleshoot-mode2 =
    .label = 문제 해결 모드…
    .accesskey = M
menu-help-exit-troubleshoot-mode =
    .label = 문제 해결 모드 끄기
    .accesskey = M
# Label of the Help menu item. Either this or
# menu-help-notdeceptive is shown.
menu-help-report-deceptive-site =
    .label = 가짜 사이트 신고…
    .accesskey = D
menu-help-not-deceptive =
    .label = 이 사이트는 가짜 사이트가 아닙니다…
    .accesskey = d
