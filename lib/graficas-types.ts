export type ChartDatum = {
  label: string;
  value: number;
};

export type GraphSummary = {
  properties: number;
  events: number;
  tasks: number;
  propertyStatus: ChartDatum[];
  eventStatus: ChartDatum[];
  taskStatus: ChartDatum[];
  propertiesByRegion: ChartDatum[];
  eventsByType: ChartDatum[];
};

export type TeamGraphSummary = {
  uid: string;
  name: string;
  role: string;
  properties: number;
  events: number;
  tasks: number;
};

export type GraphsResponse = {
  general: GraphSummary;
  personal: GraphSummary;
  team: TeamGraphSummary[] | null;
};
