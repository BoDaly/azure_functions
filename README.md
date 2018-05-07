# azure_functions
## Woo Commerce Product Setup

- Create Product Attributes
  - Sizes
    - XS,SM,MD,LG,XL,2X,3X,4X,5X,5X
  - Manufacturer
    - Full Gear
    
- Create Product
  - Sku
    - [FABRIC]-[STYLE]-SUB-[Design Name] (e.g. PT-802S-SUB-REDCLUB)
    - Fabric, Style and SUB must be Uppercase and must not vary from product catalog.
    - Design names can be lowercase or uppercase but may only have A-Z 0-9 Spaces and underscores(_) are ok.
  - Apply Size && Manufacturer Attributes
    - Sizes should be set to select and visible
    - Manufacturer should be set to  select and not-visible
    
