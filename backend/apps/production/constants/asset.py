from django.db import models


class AssetCategory(models.TextChoices):
    CHARACTER = "Character", "Character"
    ENVIRONMENT = "Environment", "Environment"
    VEHICLE = "Vehicle", "Vehicle"
    PROP = "Prop", "Prop"
    FX_RIG = "FX Rig", "FX Rig"
    SHADER_LOOKDEV = "Shader & LookDev", "Shader & LookDev"
    MATTE_PAINTING = "Matte Painting", "Matte Painting"
    CROWD_AGENT = "Crowd Agent", "Crowd Agent"
    COSTUME_GROOM = "Costume / Groom", "Costume / Groom"


class AssetSoftware(models.TextChoices):
    MAYA = "Maya", "Maya"
    HOUDINI = "Houdini", "Houdini"
    BLENDER = "Blender", "Blender"
    ZBRUSH = "ZBrush", "ZBrush"
    SUBSTANCE_PAINTER = "Substance Painter", "Substance Painter"
    UNREAL = "Unreal Engine 5", "Unreal Engine 5"
    SOLARIS = "Solaris", "Solaris"
    MARI = "Mari", "Mari"
