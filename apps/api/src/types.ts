export interface ProjectParams extends Record<string, string> {
  id: string;
}

export interface DetectionParams extends ProjectParams {
  detectionId: string;
}
