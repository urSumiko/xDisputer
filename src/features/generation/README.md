# Generation Feature Slice

Owns the dispute generation workflow, generation runs, packet assembly orchestration, and generation status.

Modernization targets:

- split the generation screen into workflow rail, template step, source data step, validation step, generate step, review step, and finalize step
- keep heavy document work out of render paths
- move generation actions into action/service modules
- add typed status and error states
