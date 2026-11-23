# 난 진짜 다 좋아

아무 말이나 입력하면 **13가지 계산 방식**(실시간 날씨, 실시간 원/달러 환율, 오늘 달 위상, 시계 각도, 초성 찾기, 발음 지문, 획수 계산, 키보드 동선, 글자 별자리, 받침 리듬파, 원소 조합, 유니코드, 말투 온도)과 4막 키네틱 모션그래픽을 거쳐 500개 메뉴 후보 중 오늘 먹을 한 끼를 도출하는 웹 앱입니다.

- 배포 주소: https://allgood-menu.vercel.app/

## 보안 및 설계 원칙

- **API 키·시크릿 0개**: 백엔드·인증·비밀 키 없이 순수 클라이언트 정적 앱으로 동작합니다.
- **엄격한 CSP 및 HTTP 보안 헤더**: `vercel.json`과 프로덕션 빌드에 `Content-Security-Policy`·`X-Frame-Options`·`HSTS`·`Permissions-Policy`·`COOP/CORP`를 적용해 `connect-src`를 공개 읽기 전용 엔드포인트 2곳(`api.open-meteo.com`, `open.er-api.com`)으로만 제한합니다.
- **외부 리소스 무결성(SRI) & Referrer 차단**: 고정 버전 Pretendard 스타일시트에 `SHA-384` SRI, `crossorigin="anonymous"`, `referrerpolicy="no-referrer"`를 적용하고, 모든 외부 요청에서 `credentials: 'omit'`과 `no-referrer`를 강제합니다.
- **데이터 출처 및 개인정보 보호**: 입력한 문장은 서버로 전송·저장되지 않으며 브라우저 내에서만 계산됩니다. 외부 날씨·환율 데이터는 Open-Meteo(CC BY 4.0) 및 ExchangeRate-API 출처를 표기하고 세션 캐싱을 적용합니다.
