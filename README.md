# AI Rally Research

사이트: https://victoryjoony.github.io/ai-rally-research/

12개 미국 주식의 종가, 실제 EPS·PER, 최초 투자 시나리오를 함께 추적하는 개인 연구용 보고서입니다.

## 매일 오전 7시 (한국 시간)

daily-update.yml은 매일 22:00 UTC, 즉 다음 날 07:00 KST에 실행됩니다. 컴퓨터나 Codex를 켜둘 필요가 없습니다. GitHub 스케줄은 정확한 시각을 보장하지 않아 늦게 실행될 수 있습니다.

- 완료된 미국 정규장 종가만 사용. 휴장일에는 마지막 거래일 값을 유지.
- 새 분기 재무자료 반영 시 실제 TTM EPS와 실적 PER 갱신.
- 새 실적, EPS 수정·감소, 매출 역성장, 마진 하락 등을 규칙으로 점검.
- 조회 실패·반영 지연 시 마지막 확인 값과 자료 기준일·경고 유지.
- 오전 7시 이후 발표되거나 공급자 반영이 늦는 실적은 다음 실행에서 반영 가능.

## 자동 자료와 분석 가정

종가와 실제 실적은 자동 갱신됩니다. 최초 FY2027E·FY2028E 시장 예상 EPS, 미래 정상화 EPS·적정 PER, 서술 판단은 2026-10-26 기준으로 보존합니다. 한 분기의 실적으로 미래 가정을 자동 상향하지 않습니다. 기존 예상 EPS로 계산한 PER는 현재 컨센서스 PER가 아닙니다.

목표일은 2028-10-26으로 고정하며 할인에 조회일부터 목표일까지 잔여기간을 사용합니다. 새 분기 재검토 표시는 src/research.json의 가정 및 scenarioReviewedPeriod를 검토·수정할 때까지 유지됩니다.

## 데이터

비공식 Yahoo Finance 공개 일별 가격·재무자료를 조회합니다. API 키나 유료 계정은 필요 없지만 공급자 변경·차단·지연 가능성이 있고 상업적 재배포 권한은 제공하지 않습니다.

- TTM 희석 EPS 직접 값 우선. 없으면 연속 4개 분기 EPS 합계를 근사치로 사용.
- 음수·0 EPS는 PER 산정 불가로 표시.
- 날짜·통화·분기 연속성·최근 공시 기간 검사.
- 최초 리서치보다 오래된 공급자 자료로 최신 값을 덮어쓰지 않음.
- 현금흐름 참고 지표는 OCF−|설비투자|로 회사 발표 FCF와 다를 수 있음.
- 분할 시 최초 주당 EPS·가치 가정을 동일 기준으로 조정.

## 실행과 배포

Node.js 22 이상, 외부 패키지 설치 없이 실행합니다.

    npm test
    npm run update
    npm run build

산출물은 dist/, 갱신 기록은 data/live.json입니다. Actions가 데이터와 index.html을 커밋하고 Pages artifact를 배포합니다. Pages 게시 방식은 GitHub Actions입니다.

실행 기록: https://github.com/victoryjoony/ai-rally-research/actions/workflows/daily-update.yml

화면의 마지막 조회·자료 기간·지연 경고를 확인하세요. 결과는 가정에 민감하며 수익 보장이나 개인별 투자 권고가 아닙니다.
