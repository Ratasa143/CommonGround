export const campusHostels = [
  { id: "north-hostel", name: "North Hostel" },
  { id: "south-hostel", name: "South Hostel" },
  { id: "east-hostel", name: "East Hostel" },
] as const;

export const campusLocations = [
  ...campusHostels,
  { id: "central-library", name: "Central Library" },
  { id: "north-study-space", name: "North Hostel Study Space" },
  { id: "south-common-room", name: "South Hostel Common Room" },
] as const;

export const campusStudySpaces = [
  { id: "north-study-space", locationId: "north-hostel", name: "North Hostel Study Space" },
  { id: "south-common-room", locationId: "south-hostel", name: "South Hostel Common Room" },
  { id: "central-library", locationId: "central-library", name: "Central Library Study Area" },
] as const;
