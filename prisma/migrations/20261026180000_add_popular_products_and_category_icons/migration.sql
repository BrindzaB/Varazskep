-- CreateTable
CREATE TABLE "PopularProduct" (
    "key" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "PopularProduct_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "CategoryIcon" (
    "category" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "CategoryIcon_pkey" PRIMARY KEY ("category")
);

