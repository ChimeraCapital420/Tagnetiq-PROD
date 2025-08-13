export default function handler(req, res) {
  const mockData = {
    address: req.query?.address,
    zestimate: null,
    redfinEstimate: null,
    status: "Awaiting API key configuration",
    comps: []
  };
  res.status(200).json(mockData);
}
