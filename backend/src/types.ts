export interface ProjectParams extends Record<string, string> {
  id: string;
}

export interface PageParams extends ProjectParams {
  pageId: string;
}

export interface DetectionParams extends PageParams {
  detectionId: string;
}
