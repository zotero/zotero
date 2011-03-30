<xsl:stylesheet xmlns:cs="http://purl.org/net/xbiblio/csl" xmlns="http://purl.org/net/xbiblio/csl"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0" exclude-result-prefixes="cs">

  <xsl:output indent="yes" method="xml" encoding="utf-8"/>
  <xsl:strip-space elements="*"/>

  <!-- * xml:lang is no longer allowed on cs:style to eliminate confusion with
         the default-locale attribute. If xml:lang was set, its value is
         transferred to the default-locale attribute.
       * cs:style now indicates CSL version compatibility via the version
         attribute. -->
  <xsl:template match="/cs:style">
    <xsl:copy>
      <xsl:copy-of select="@*[not(name()='xml:lang')]"/>
      <xsl:choose>
        <xsl:when test="@xml:lang and not(@xml:lang='en' or @xml:lang='en-US' or @xml:lang='en-us')">
          <xsl:attribute name="default-locale">
            <xsl:value-of select="@xml:lang"/>
          </xsl:attribute>
        </xsl:when>
      </xsl:choose>
      <xsl:attribute name="version">1.0</xsl:attribute>
      <xsl:attribute name="demote-non-dropping-particle">sort-only</xsl:attribute>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>

  <!-- Elements that themselves can be copied verbatim but whose child nodes
       might require modification. -->
  <xsl:template
    match="cs:choose|cs:else|cs:info|cs:names|cs:substitute|cs:macro|cs:layout">
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>

  <!-- Elements that can be copied verbatim together with any child nodes. -->
  <xsl:template match="cs:sort|cs:number|comment()">
    <xsl:copy-of select="."/>
  </xsl:template>

  <!-- Child elements of cs:info that can be copied verbatim. -->
  <xsl:template
    match="cs:author|cs:contributor|cs:id|cs:issn|cs:published|cs:rights|cs:source|cs:summary|cs:title|cs:updated">
    <xsl:copy-of select="."/>
  </xsl:template>

  <!-- For the rel attribute on cs:link, "documentation" will be used instead of
       "homepage", and "source" has been renamed to "independent-parent". The
       URL of a dependent style is now accompanied with a rel value of "self". -->
  <xsl:template match="cs:link">
    <xsl:variable name="rel-value">
      <xsl:choose>
        <xsl:when test="@rel='documentation' or @rel='homepage'">documentation</xsl:when>
        <xsl:when test="@rel='template'">template</xsl:when>
        <xsl:when test="@rel='source'">independent-parent</xsl:when>
        <xsl:otherwise>self</xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:copy>
      <xsl:attribute name="href">
        <xsl:value-of select="@href"/>
      </xsl:attribute>
      <xsl:attribute name="rel">
        <xsl:value-of select="$rel-value"/>
      </xsl:attribute>
    </xsl:copy>
  </xsl:template>

  <!-- The citation-format and field attributes have replaced the term attribute
       on cs:category, and the "in-text" category has been removed. Styles with
       the "in-text" category are assigned the "numeric" citation-format if the
       "citation-number" variable is used in citations, and the "author-date"
       format in all other cases. -->
  <xsl:template match="cs:category">
    <xsl:choose>
      <xsl:when test="@term='in-text'">
        <xsl:choose>
          <xsl:when test="/cs:style/cs:citation//cs:text[@variable='citation-number']">
            <xsl:copy>
              <xsl:attribute name="citation-format">numeric</xsl:attribute>
            </xsl:copy>
          </xsl:when>
          <xsl:otherwise>
            <xsl:copy>
              <xsl:attribute name="citation-format">author-date</xsl:attribute>
            </xsl:copy>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:when>
      <xsl:when test="@term='author-date' or @term='numeric' or @term='label' or @term='note'">
        <xsl:copy>
          <xsl:attribute name="citation-format">
            <xsl:value-of select="@term"/>
          </xsl:attribute>
        </xsl:copy>
      </xsl:when>
      <xsl:otherwise>
        <xsl:copy>
          <xsl:attribute name="field">
            <xsl:value-of select="@term"/>
          </xsl:attribute>
        </xsl:copy>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- The hierarchy cs:terms/cs:locale/cs:term has been replaced by
       cs:locale/cs:terms/cs:term. -->
  <xsl:template match="cs:terms/cs:locale">
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:element name="terms">
        <xsl:copy-of select="cs:term"/>
      </xsl:element>
    </xsl:copy>
  </xsl:template>

  <!-- Citation-specific CSL options are now set as attributes on cs:citation,
       instead of via cs:option elements. -->
  <xsl:template match="cs:citation">
    <xsl:copy>
      <xsl:for-each select="cs:option">
        <xsl:attribute name="{@name}">
          <xsl:value-of select="@value"/>
        </xsl:attribute>
      </xsl:for-each>
      <xsl:apply-templates select="cs:layout|cs:sort"/>
    </xsl:copy>
  </xsl:template>

  <!-- * Bibliography-specific CSL options are now set as attributes on
         cs:bibliography, instead of via cs:option elements.
       * second-field-align now uses the value "flush" instead of "true". -->
  <xsl:template match="cs:bibliography">
    <xsl:copy>
      <xsl:for-each select="cs:option">
        <xsl:choose>
          <xsl:when test="@name='second-field-align' and @value='true'">
            <xsl:attribute name="second-field-align">flush</xsl:attribute>
          </xsl:when>
          <xsl:otherwise>
            <xsl:attribute name="{@name}">
              <xsl:value-of select="@value"/>
            </xsl:attribute>
          </xsl:otherwise>
        </xsl:choose>
      </xsl:for-each>
      <xsl:apply-templates select="cs:layout|cs:sort"/>
    </xsl:copy>
  </xsl:template>

  <!-- CSL 1.0 eliminates item type fallback behavior in conditionals
       ("article", "book" and "chapter" used to be type archetypes, e.g.
       "article-journal" would be a subtype of "article", see
       http://docs.google.com/View?id=dg6h9k72_64hzmsmqgb). For the conversion,
       each archetype is replaced by all subtypes of that archetype (while
       making sure that "song" is only present once in the attribute string, as
       "song" is a subtype of both "article" and "book"). If an archetype is
       replaced by its subtypes, the match attribute is set to "any", unless
       match was set to "none". This is done as "type='chapter' match='all'" can
       test true, but "type='chapter paper-conference' match='all' can not (each
       item is of a single type). cs:if and cs:if-else elements that, in
       addition to the type conditional, test with match="all" (the default
       attribute value) and carry additional conditionals are split into a
       nested conditional (an example of this case is given at
       http://forums.zotero.org/discussion/11960/item-type-testing-in-csl-10-and-fallbacks/#Comment_58392
       ). -->
  <xsl:template match="cs:if|cs:else-if">
    <xsl:copy>
      <xsl:choose>
        <xsl:when test="contains(@type,'book') or (contains(@type,'article') and not(contains(@type,'article-'))) or contains(@type,'chapter')">
          <xsl:choose>
            <xsl:when test="(not(@match='any') and not(@match='none')) and (@variable or @is-numeric or @position or @disambiguate)">
              <xsl:call-template name="fallback-replacement"/>
              <xsl:attribute name="match">any</xsl:attribute>
              <xsl:element name="choose">
                <xsl:element name="if">
                  <xsl:copy-of select="@*[not(name()='type')]"/>
                  <xsl:apply-templates/> 
                </xsl:element>
              </xsl:element>
            </xsl:when>
            <xsl:otherwise>
              <xsl:copy-of select="@*"/>
              <xsl:call-template name="fallback-replacement"/>
              <xsl:if test="not(@match='none')">
                <xsl:attribute name="match">any</xsl:attribute>
              </xsl:if>
              <xsl:apply-templates/>
            </xsl:otherwise>
          </xsl:choose>
        </xsl:when>
        <xsl:otherwise>
          <xsl:copy-of select="@*"/>
          <xsl:apply-templates/>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:copy>
  </xsl:template>

  <xsl:template name="fallback-replacement">
    <xsl:choose>
      <xsl:when test="contains(@type,'book')">
        <xsl:attribute name="type">
          <xsl:call-template name="book-sans-space"/>
          <xsl:call-template name="article"/>
          <xsl:call-template name="chapter"/>
        </xsl:attribute>
      </xsl:when>
      <xsl:when test="contains(@type,'article') and not(contains(@type,'article-'))">
        <xsl:attribute name="type">
          <xsl:call-template name="article-sans-space"/>
          <xsl:call-template name="book"/>
          <xsl:call-template name="chapter"/>
        </xsl:attribute>
      </xsl:when>
      <xsl:when test="contains(@type,'chapter')">
        <xsl:attribute name="type">
          <xsl:call-template name="chapter-sans-space"/>
          <xsl:call-template name="article"/>
          <xsl:call-template name="book"/>
        </xsl:attribute>
      </xsl:when>
    </xsl:choose>
  </xsl:template>      

  <xsl:template name="book-sans-space">
    <xsl:text>bill book graphic legal_case motion_picture report song</xsl:text>
  </xsl:template>

  <xsl:template name="article-sans-space">
    <xsl:choose>
      <xsl:when test="contains(@type,'article') and not(contains(@type,'article-')) and contains(@type,'book')">article-journal article-magazine article-newspaper broadcast interview manuscript map patent personal_communication speech thesis webpage</xsl:when>
      <xsl:when test="contains(@type,'article') and not(contains(@type,'article-'))">article-journal article-magazine article-newspaper broadcast interview manuscript map patent personal_communication song speech thesis webpage</xsl:when>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="chapter-sans-space">
    <xsl:text>chapter paper-conference</xsl:text>
  </xsl:template>

  <xsl:template name="book">
    <xsl:choose>
      <xsl:when test="contains(@type,'book')"> bill book graphic legal_case motion_picture report song</xsl:when>
      <xsl:otherwise>
        <xsl:if test="contains(@type,'bill')"> bill</xsl:if>
        <xsl:if test="contains(@type,'graphic')"> graphic</xsl:if>
        <xsl:if test="contains(@type,'legal_case')"> legal_case</xsl:if>
        <xsl:if test="contains(@type,'motion_picture')"> motion_picture</xsl:if>
        <xsl:if test="contains(@type,'report')"> report</xsl:if>
        <xsl:if test="contains(@type,'song')"> song</xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="article">
    <xsl:choose>
      <xsl:when test="contains(@type,'article') and not(contains(@type,'article-')) and contains(@type,'book')"> article-journal article-magazine article-newspaper broadcast interview manuscript map patent personal_communication speech thesis webpage</xsl:when>
      <xsl:when test="contains(@type,'article') and not(contains(@type,'article-'))"> article-journal article-magazine article-newspaper broadcast interview manuscript map patent personal_communication song speech thesis webpage</xsl:when>
      <xsl:otherwise>
        <xsl:if test="contains(@type,'article-journal')"> article-journal</xsl:if>
        <xsl:if test="contains(@type,'article-magazine')"> article-magazine</xsl:if>
        <xsl:if test="contains(@type,'article-newspaper')"> article-newspaper</xsl:if>
        <xsl:if test="contains(@type,'broadcast')"> broadcast</xsl:if>
        <xsl:if test="contains(@type,'interview')"> interview</xsl:if>
        <xsl:if test="contains(@type,'manuscript')"> manuscript</xsl:if>
        <xsl:if test="contains(@type,'map')"> map</xsl:if>
        <xsl:if test="contains(@type,'patent')"> patent</xsl:if>
        <xsl:if test="contains(@type,'personal_communication')"> personal_communication</xsl:if>
        <xsl:if test="contains(@type,'speech')"> speech</xsl:if>
        <xsl:if test="contains(@type,'thesis')"> thesis</xsl:if>
        <xsl:if test="contains(@type,'map')"> map</xsl:if>
        <xsl:if test="contains(@type,'webpage')"> webpage</xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template name="chapter">
    <xsl:choose>
      <xsl:when test="contains(@type,'chapter')"> chapter paper-conference</xsl:when>
      <xsl:otherwise>
        <xsl:if test="contains(@type,'paper-conference')"> paper-conference</xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- * The class attribute on cs:group has been removed in favor of the
         display attribute.
       * The " by " prefix on cs:group is removed if the element encloses a
         cs:names element calling the container-author variable and including a
         label. This is done to prevent duplication of "by" as a result of the
         new verb-short container-author term in CSL 1.0 locale files. -->
  <xsl:template match="cs:group">
    <xsl:copy>
      <xsl:choose>
        <xsl:when test="@prefix=' by ' and cs:names/@variable='container-author' and cs:names/cs:label">
          <xsl:copy-of select="@*[not(name()='class' or name()='prefix')]"/>
        </xsl:when>
        <xsl:otherwise>
          <xsl:copy-of select="@*[not(name()='class')]"/>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>

  <!-- * The text-case attribute can no longer be used on cs:name. In cases
         where text-case was used on cs:name, the attribute and its value are
         transferred to the "family" and "given" cs:name-part children.
       * The Zotero and Mendeley CSL 0.8.1 processors ignored name-as-sort-order
         when sort-separator was not set. In CSL 1.0, name-as-sort-order always
         takes effect, with a default value of ", " for sort-separator. To
         correct for this change in behavior, the name-as-sort-order attribute
         is dropped from cs:name when sort-separator was absent. -->
  <xsl:template match="cs:name">
    <xsl:copy>
      <xsl:choose>
        <xsl:when test="@name-as-sort-order and not(@sort-separator)">
          <xsl:copy-of select="@*[not(name()='text-case' or name()='name-as-sort-order')]"/>
        </xsl:when>
	<xsl:otherwise>
          <xsl:copy-of select="@*[not(name()='text-case')]"/>
	</xsl:otherwise>
      </xsl:choose>
      <xsl:choose>
        <xsl:when test="@text-case">
          <xsl:element name="name-part">
            <xsl:attribute name="name">family</xsl:attribute>
            <xsl:attribute name="text-case">
              <xsl:value-of select="@text-case"/>
            </xsl:attribute>
          </xsl:element>
          <xsl:element name="name-part">
            <xsl:attribute name="name">given</xsl:attribute>
            <xsl:attribute name="text-case">
              <xsl:value-of select="@text-case"/>
            </xsl:attribute>
          </xsl:element>
        </xsl:when>
      </xsl:choose>
    </xsl:copy>
  </xsl:template>

  <!-- * In CSL 1.0, abbreviated terms are defined with periods, if applicable,
         and the include-period attribute has replaced the strip-periods
         attribute. For the conversion, strip-periods is set to "true" for any
         cs:label element with form="short" or "verb-short", except when
         include-period was set to "true".
       * plural on cs:label now uses "always"/"never" instead of "true"/"false". -->
  <xsl:template match="cs:label">
    <xsl:copy>
      <xsl:copy-of select="@*[not(name()='include-period')]"/>
      <xsl:choose>
        <xsl:when test="(@form='short' or @form='verb-short') and not(@include-period='true')">
          <xsl:attribute name="strip-periods">true</xsl:attribute>
        </xsl:when>
      </xsl:choose>
      <xsl:choose>
        <xsl:when test="@plural='false'">
          <xsl:attribute name="plural">never</xsl:attribute>
        </xsl:when>
        <xsl:when test="@plural='true'">
          <xsl:attribute name="plural">always</xsl:attribute>
        </xsl:when>
      </xsl:choose>
    </xsl:copy>
  </xsl:template>

  <!-- The "event" date variable has been renamed to "event-date" to eliminate
       the name conflict with the 'standard' "event" variable. -->
  <xsl:template match="cs:date">
     <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:choose>
        <xsl:when test="@variable='event'">
          <xsl:attribute name="variable">event-date</xsl:attribute>
        </xsl:when>
      </xsl:choose>
      <xsl:apply-templates/>
    </xsl:copy>
  </xsl:template>

  <!-- In CSL 1.0, abbreviated terms are defined with periods, if applicable,
       and the include-period attribute has replaced the strip-periods
       attribute. For the conversion, strip-periods is set to "true" for any
       "month" cs:date-part element with form="short", except when
       include-period was set to "true". -->
  <xsl:template match="cs:date-part">
    <xsl:choose>
      <xsl:when test="@name='year' or @name='month' or @name='day'">
        <xsl:copy>
          <xsl:copy-of select="@*[not(name()='include-period')]"/>
          <xsl:choose>
            <xsl:when
              test="@form='short' and @name='month' and not(@include-period='true')">
              <xsl:attribute name="strip-periods">true</xsl:attribute>
            </xsl:when>
          </xsl:choose>
        </xsl:copy>
      </xsl:when>
    </xsl:choose>
  </xsl:template>

  <!-- * In CSL 1.0, abbreviated terms are defined with periods, if applicable,
         and the include-period attribute has replaced the strip-periods
         attribute. For the conversion, strip-periods is set to "true" for any
         cs:text element with form="short" or "verb-short", except when
         include-period was set to "true".
       * A special case is the "ibid" term. "ibid" is not defined as a
         short-form term, but is an abbreviation, and should carry a period
         ("ibid."). This period, absent in CSL 0.8 locale files, will be
         included in CSL 1.0 locale files. To prevent double periods, suffix="."
         will be removed from any cs:text element calling the "ibid" term.
       * The CSL 0.8 en-US locale file only included the "long" form of the
         "no date" term, with a value of "n.d.". In the CSL 1.0 locale file, the
         value has been changed to "no date", and a "short" form ("n.d.") has
         been introduced. For the conversion, any cs:text element that called
         the "long" form of the "no date" term will now call the "short" form,
         unless the "long" form had been redefined in the style. -->
  <xsl:template match="cs:text">
    <xsl:choose>
      <xsl:when test="@term='ibid' and @suffix='.'">
        <xsl:copy>
          <xsl:copy-of select="@*[not(name()='suffix')]"/>
        </xsl:copy>
      </xsl:when>
      <xsl:otherwise>
        <xsl:copy>
          <xsl:copy-of select="@*[not(name()='include-period')]"/>
          <xsl:choose>
            <xsl:when
              test="(@form='short' or @form='verb-short') and not(@include-period='true' or @term='no date') and @term">
              <xsl:attribute name="strip-periods">true</xsl:attribute>
            </xsl:when>
          </xsl:choose>
          <xsl:choose>
            <xsl:when test="@term='no date' and not(/cs:style/cs:terms/cs:locale/cs:term/@name='no date')">
              <xsl:attribute name="form">short</xsl:attribute>
            </xsl:when>
          </xsl:choose>
        </xsl:copy>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
