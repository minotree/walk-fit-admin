export const RESET_TABLES = ['site_equipment', 'exercise_sites', 'equipment_catalog', 'survey_locations'] as const;
export const RESET_BUCKETS = ['equipment-images', 'survey-photos'] as const;
export const RESET_CONFIRMATION = '전체 초기화';
type Table = typeof RESET_TABLES[number];
type Bucket = typeof RESET_BUCKETS[number];
export type ResetPreview = { tables: Record<Table, number>; buckets: Record<Bucket, string[]> };
export interface ResetBackend {
  verifyAdmin: () => Promise<void>;
  count: (table: Table) => Promise<number>;
  list: (bucket: Bucket, prefix: string, offset: number) => Promise<{ name: string; id: string | null }[]>;
  remove: (bucket: Bucket, paths: string[]) => Promise<void>;
  deleteRows: (table: Table) => Promise<void>;
}

export function createDataReset(backend: ResetBackend) {
  async function files(bucket: Bucket): Promise<string[]> {
    const result: string[] = [];
    const folders = [''];
    const visited = new Set<string>();
    while (folders.length) {
      const prefix = folders.pop()!;
      if (visited.has(prefix)) throw new Error('버킷 폴더가 중복되어 조회를 중단했습니다.');
      visited.add(prefix);
      for (let offset = 0; ; offset += 1000) {
        const page = await backend.list(bucket, prefix, offset);
        for (const item of page) {
          const path = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) folders.push(path); else result.push(path);
        }
        if (page.length < 1000) break;
      }
    }
    return result.sort();
  }
  async function preview(): Promise<ResetPreview> {
    await backend.verifyAdmin();
    const tables = {} as ResetPreview['tables'];
    const buckets = {} as ResetPreview['buckets'];
    for (const table of RESET_TABLES) tables[table] = await backend.count(table);
    for (const bucket of RESET_BUCKETS) buckets[bucket] = await files(bucket);
    return { tables, buckets };
  }
  async function reset(expected: ResetPreview, confirmation: string, progress: (message: string) => void) {
    if (confirmation !== RESET_CONFIRMATION) throw new Error('확인 문구가 일치하지 않습니다.');
    progress('관리자 권한과 삭제 대상을 다시 확인하고 있습니다.');
    const current = await preview();
    if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error('미리보기 이후 데이터가 변경되었습니다. 삭제 대상을 새로 조회해 주세요.');
    let stage = '';
    try {
      for (const bucket of RESET_BUCKETS) {
        stage = `${bucket} 이미지 삭제`; progress(stage);
        for (let i = 0; i < current.buckets[bucket].length; i += 1000)
          await backend.remove(bucket, current.buckets[bucket].slice(i, i + 1000));
      }
      for (const table of RESET_TABLES) {
        stage = `${table} 데이터 삭제`; progress(stage);
        await backend.deleteRows(table);
        if (await backend.count(table) !== 0) throw new Error('남은 행이 있습니다. 서버의 삭제 권한과 RLS 정책을 확인해 주세요.');
      }
      stage = '삭제 결과 검증'; progress(stage);
      const remaining = await preview();
      if (RESET_TABLES.some(table => remaining.tables[table] !== 0) || RESET_BUCKETS.some(bucket => remaining.buckets[bucket].length !== 0))
        throw new Error('데이터나 파일이 남아 있습니다. 새로 유입된 데이터 또는 삭제 권한을 확인해 주세요.');
      return remaining;
    } catch (error) {
      throw new Error(`${stage} 중 중단되었습니다. 일부 항목은 이미 삭제됐을 수 있습니다. ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }
  return { preview, reset };
}
