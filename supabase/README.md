# 사진 조인 및 조사 승인 적용

사진 원본 경로는 `survey_locations.stamped_photo_path`와 `equipment_catalog.default_image_path`에서 관리합니다.
지점은 `survey_location_id`, 설치 기구는 `equipment_id`로 원본을 조인합니다.
지점 저장 API는 사진 경로나 연결 ID를 복사하지 않습니다.

## 적용 순서

1. 기존 DB를 백업하고 `audit-photo-relations.sql`을 SQL Editor에서 실행합니다. 조회 전용입니다.
2. 중복·상충하는 조사/지점 연결을 확인합니다. 한 조사와 한 지점을 서로 연결하는 구조를 전제로 합니다.
   여러 조사를 한 지점에 연결할 의도라면 이 마이그레이션을 적용하기 전에 관계 설계를 조정해야 합니다.
3. 별도 PWA가 `exercise_sites.site_image_path`를 직접 읽는다면 먼저
   `survey_locations!survey_location_id(stamped_photo_path)` 조인으로 변경합니다.
   이 저장소에는 PWA 소스가 없어 여기서는 변경하지 못했습니다.
4. `migrations/20261021_joined_photos_and_approval.sql` 전체를 실행합니다.
   연결 충돌이 있으면 트랜잭션 전체가 취소됩니다.
5. 점검 SQL을 다시 실행합니다. 서로 다른 사진 경로와 조사 연결 없는 지점은 자동 처리하지 않습니다.
   이관된 사진과 기존 지점 사진을 비교한 뒤 남은 데이터의 원본을 결정하세요.
6. 관리자 앱을 배포합니다. 조사 승인은 새 RPC를 사용하므로 SQL을 먼저 적용해야 합니다.

마이그레이션은 누락된 단방향 연결을 보완하고, 조사에 사진이 없으면 지점의 경로를 이관합니다.
경로가 정확히 같은 중복 값만 지점 컬럼에서 비웁니다. 파일 자체는 삭제하지 않습니다.
두 경로가 URL/상대 경로로 다르게 표현되어 있어도 자동으로 같다고 판단하지 않습니다.

`site_image_path` 컬럼은 기존 클라이언트와 미이관 데이터를 위해 유지합니다.
앱도 조사 사진이 없는 경우에만 기존 지점 사진을 표시하고, 파일 정리 시 기존 지점 참조를 계속 확인합니다.
기존 값이 남아 있으면 해당 파일은 자동 삭제하지 않습니다.

승인 RPC는 관리자 확인, 조사 행 잠금, 기존 지점 재사용, 지점 생성,
조사 승인 상태 및 양방향 연결 저장을 한 트랜잭션으로 처리합니다.
호출 계정의 기존 RLS를 사용하며 권한 오류는 전체 취소됩니다. 서비스 역할 키를 사용하지 않습니다.

## 검증 범위

`npm run build`, `node --test scripts/test-site-photo.mjs scripts/test-image-cleanup.mjs scripts/test-image-replacement.mjs`,
`node scripts/test-equipment-save.mjs`로 로컬 코드를 검증합니다.
SQL은 실제 스키마의 기본값·제약조건·트리거·RLS에 영향을 받으므로 DB 적용 후
승인 재호출 시 동일 지점 반환, 권한 오류 시 롤백, 대표 사진 교체 후 조인 표시를 확인해야 합니다.
